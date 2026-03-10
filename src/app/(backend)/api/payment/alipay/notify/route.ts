/**
 * Alipay Payment Notification Callback Handler
 * Handles payment success notifications from Alipay
 */
import {
  paymentNotifications,
  paymentOrders,
  serverDB,
  subscriptionPlans,
  userBalances,
  userExtensions,
  userSubscriptionHistory,
  userTransactions,
} from '@lobechat/database';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { AlipayPrecreateChannel } from '@/server/modules/payment/channels/alipay-precreate';

// Helper to calculate expiration date
function calculateExpiresAt(
  subscriptionType: 'recurring' | 'onetime',
  billingInterval: 'month' | 'year',
  durationMonths?: number | null,
): Date {
  const now = new Date();
  const expiresAt = new Date(now);

  if (subscriptionType === 'onetime') {
    // One-time payment: add duration months
    expiresAt.setMonth(expiresAt.getMonth() + (durationMonths || 1));
  } else if (billingInterval === 'year') {
    // Yearly recurring subscription
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    // Monthly recurring subscription
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  return expiresAt;
}

// Helper to calculate next credit grant date (1 month from now)
function calculateNextCreditGrantAt(): Date {
  const now = new Date();
  const nextGrant = new Date(now);
  nextGrant.setMonth(nextGrant.getMonth() + 1);
  return nextGrant;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Read raw body
    const rawBody = await request.text();

    // 2. Initialize Alipay channel for signature verification
    const alipayConfig = {
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',
      appId: process.env.ALIPAY_APP_ID || '',
      notifyUrl: process.env.ALIPAY_NOTIFY_URL || '',
      privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
      sandbox: process.env.ALIPAY_SANDBOX === 'true',
    };

    if (!alipayConfig.appId || !alipayConfig.privateKey || !alipayConfig.alipayPublicKey) {
      console.error('Alipay configuration is incomplete');
      return new NextResponse('fail', {
        headers: { 'Content-Type': 'text/plain' },
        status: 500,
      });
    }

    const alipayChannel = new AlipayPrecreateChannel(alipayConfig);

    // 3. Parse and verify notification
    const notificationResult = await alipayChannel.parseNotification(rawBody);

    // Log all notifications for audit
    await serverDB.insert(paymentNotifications).values({
      id: crypto.randomUUID(),
      orderNo: notificationResult.orderNo || 'unknown',
      payChannel: 'alipay_precreate',
      rawData: rawBody,
      status: notificationResult.success ? 'success' : 'fail',
    });

    if (!notificationResult.success) {
      console.error('Failed to parse notification:', notificationResult.errorMessage);
      return new NextResponse('fail', {
        headers: { 'Content-Type': 'text/plain' },
        status: 400,
      });
    }

    const { orderNo, channelOrderNo, paidAt, amount } = notificationResult;

    // 4. Query payment order
    const orderResult = await serverDB
      .select()
      .from(paymentOrders)
      .where(eq(paymentOrders.orderNo, orderNo))
      .limit(1);

    if (!orderResult || orderResult.length === 0) {
      console.error('Order not found:', orderNo);
      return new NextResponse('fail', {
        headers: { 'Content-Type': 'text/plain' },
        status: 404,
      });
    }

    const order = orderResult[0];

    // 5. Idempotency check: if already paid, return success immediately
    if (order.status === 'paid') {
      console.log('Order already paid, returning success:', orderNo);
      return new NextResponse('success', {
        headers: { 'Content-Type': 'text/plain' },
        status: 200,
      });
    }

    // 6. Verify amount matches
    if (amount && amount !== order.amount) {
      console.error('Amount mismatch:', { expected: order.amount, received: amount });
      await serverDB.insert(paymentNotifications).values({
        id: crypto.randomUUID(),
        orderNo,
        payChannel: 'alipay_precreate',
        rawData: `Amount mismatch: expected ${order.amount}, received ${amount}`,
        status: 'fail',
      });
      return new NextResponse('fail', {
        headers: { 'Content-Type': 'text/plain' },
        status: 400,
      });
    }

    // 7. Process payment success in a transaction
    await serverDB.transaction(async (tx) => {
      // 7a. Update payment order
      await tx
        .update(paymentOrders)
        .set({
          channelOrderNo,
          paidAt: paidAt || new Date(),
          status: 'paid',
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.orderNo, orderNo));

      // 7b. Query plan details
      const planResult = await tx
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, order.planId))
        .limit(1);

      if (!planResult || planResult.length === 0) {
        throw new Error(`Plan not found: ${order.planId}`);
      }

      const plan = planResult[0];

      // 7c. Calculate dates
      const now = new Date();
      const subscriptionType = (order.subscriptionType || 'recurring') as 'recurring' | 'onetime';
      const durationMonths = order.durationMonths;
      const planInterval = order.planInterval as 'month' | 'year';
      const expiresAt = calculateExpiresAt(subscriptionType, planInterval, durationMonths);

      // For one-time payments, don't set nextCreditGrantAt (no auto-renewal)
      const nextCreditGrantAt =
        subscriptionType === 'recurring' ? calculateNextCreditGrantAt() : null;

      // 7d. Update or insert user_extensions
      const existingUserExt = await tx
        .select()
        .from(userExtensions)
        .where(eq(userExtensions.userId, order.userId))
        .limit(1);

      if (existingUserExt && existingUserExt.length > 0) {
        // Update existing record
        await tx
          .update(userExtensions)
          .set({
            billingInterval: order.planInterval,
            currentPlan: plan.slug,
            durationMonths,
            nextCreditGrantAt,
            planExpiresAt: expiresAt,
            planId: plan.id,
            subscriptionType,
            updatedAt: now,
          })
          .where(eq(userExtensions.userId, order.userId));
      } else {
        // Insert new record
        await tx.insert(userExtensions).values({
          billingInterval: order.planInterval,
          createdAt: now,
          currentPlan: plan.slug,
          durationMonths,
          id: crypto.randomUUID(),
          nextCreditGrantAt,
          planExpiresAt: expiresAt,
          planId: plan.id,
          subscriptionType,
          updatedAt: now,
          userId: order.userId,
        });
      }

      // 7e. Mark old subscription records as inactive
      await tx
        .update(userSubscriptionHistory)
        .set({
          isActive: false,
        })
        .where(
          and(
            eq(userSubscriptionHistory.userId, order.userId),
            eq(userSubscriptionHistory.isActive, true),
          ),
        );

      // 7f. Write subscription history
      const price = order.planInterval === 'year' ? plan.yearlyPrice : plan.monthlyPrice;
      await tx.insert(userSubscriptionHistory).values({
        createdAt: now,
        durationMonths,
        endedAt: expiresAt,
        id: crypto.randomUUID(),
        isActive: true,
        orderNo,
        planId: plan.id,
        planName: plan.name,
        planType: plan.type,
        price: price || order.amount,
        slug: plan.slug,
        startedAt: now,
        status: 'active',
        subscriptionType,
        userId: order.userId,
      });

      // 7g. Grant credits - Reset balance to plan credits
      const existingBalance = await tx
        .select()
        .from(userBalances)
        .where(eq(userBalances.userId, order.userId))
        .limit(1);

      const credits = Number.parseInt(plan.credits, 10);

      if (existingBalance && existingBalance.length > 0) {
        // Update balance
        await tx
          .update(userBalances)
          .set({
            balance: String(credits),
            updatedAt: now,
          })
          .where(eq(userBalances.userId, order.userId));
      } else {
        // Insert new balance
        await tx.insert(userBalances).values({
          balance: String(credits),
          createdAt: now,
          updatedAt: now,
          userId: order.userId,
        });
      }

      // 7h. Write transaction record
      await tx.insert(userTransactions).values({
        amount: String(credits),
        balanceAfter: String(credits),
        category: 'SUBSCRIPTION_PURCHASE',
        createdAt: now,
        id: crypto.randomUUID(),
        metadata: {
          billingInterval: order.planInterval,
          orderNo,
          planId: plan.id,
          planSlug: plan.slug,
        },
        type: 'SUBSCRIPTION_GRANT',
        userId: order.userId,
      });
    });

    // 8. Return success response (Alipay requires "success" string)
    console.log('Payment processed successfully:', orderNo);
    return new NextResponse('success', {
      headers: { 'Content-Type': 'text/plain' },
      status: 200,
    });
  } catch (error) {
    console.error('Error processing Alipay payment notification:', error);
    return new NextResponse('fail', {
      headers: { 'Content-Type': 'text/plain' },
      status: 500,
    });
  }
}
