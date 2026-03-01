/**
 * Auto Deduct Cron Job
 *
 * Handles automatic deduction for recurring subscriptions.
 *
 * Schedule:
 * - 09:00: First deduction attempt
 * - 12:00: Second (final) deduction attempt for failed ones
 *
 * Run frequency: Twice daily at 09:00 and 12:00
 * Vercel Cron: "0 9,12 * * *" (UTC+8 would be "0 1,4 * * *" in UTC)
 */
import {
  paymentNotifications,
  serverDB,
  subscriptionPlans,
  userAgreements,
  userBalances,
  userExtensions,
  userSubscriptionHistory,
  userTransactions,
} from '@lobechat/database';
import { and, eq, lte, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

import { AlipayCycleChannel } from '@/server/modules/payment/channels/alipay-cycle';
import { generateOrderNo } from '@/server/modules/payment/utils/order-no';

const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-key';

// Get current hour in China timezone (UTC+8)
function getChinaHour(): number {
  const now = new Date();
  const chinaOffset = 8 * 60; // UTC+8 in minutes
  const localOffset = now.getTimezoneOffset();
  const chinaTime = new Date(now.getTime() + (chinaOffset + localOffset) * 60 * 1000);
  return chinaTime.getHours();
}

// Helper to calculate next expiration date
function calculateNextExpiresAt(billingInterval: 'month' | 'year'): Date {
  const now = new Date();
  const expiresAt = new Date(now);

  if (billingInterval === 'year') {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }

  return expiresAt;
}

// Helper to calculate next credit grant date
function calculateNextCreditGrantAt(): Date {
  const now = new Date();
  const nextGrant = new Date(now);
  nextGrant.setMonth(nextGrant.getMonth() + 1);
  return nextGrant;
}

// Helper to calculate next deduct date
function calculateNextDeductDate(periodType: string, period: number): string {
  const now = new Date();
  const nextDate = new Date(now);

  if (periodType === 'MONTH') {
    nextDate.setMonth(nextDate.getMonth() + period);
    if (nextDate.getDate() > 28) {
      nextDate.setDate(28);
    }
  } else {
    nextDate.setDate(nextDate.getDate() + period);
  }

  return nextDate.toISOString().split('T')[0];
}

/**
 * Process auto deduction for a single agreement
 */
async function processDeduction(
  cycleChannel: AlipayCycleChannel,
  agreement: any,
  plan: any,
  isRetry: boolean,
): Promise<{ reason?: string; success: boolean }> {
  const orderNo = generateOrderNo();
  const amount = agreement.singleAmount;

  console.log(
    `[AutoDeduct] Processing: user=${agreement.userId}, plan=${plan.slug}, amount=${amount}, retry=${isRetry}`,
  );

  try {
    // Call Alipay to deduct
    const result = await cycleChannel.deductPayment({
      agreementNo: agreement.agreementNo,
      amount,
      orderNo,
      subject: `${plan.name} 自动续费`,
    });

    // Log the deduction attempt
    await serverDB.insert(paymentNotifications).values({
      id: crypto.randomUUID(),
      orderNo,
      payChannel: 'alipay_cycle_deduct',
      rawData: JSON.stringify({
        agreementNo: agreement.agreementNo,
        amount,
        isRetry,
        result,
        userId: agreement.userId,
      }),
      status: result.status === 'success' ? 'success' : 'fail',
    });

    if (result.status === 'success') {
      // Deduction successful - renew subscription
      const now = new Date();
      const billingInterval = agreement.billingInterval as 'month' | 'year';
      const newExpiresAt = calculateNextExpiresAt(billingInterval);
      const nextCreditGrantAt = calculateNextCreditGrantAt();
      const nextDeductDate = calculateNextDeductDate(agreement.periodType, agreement.period);
      const credits = Number.parseInt(plan.credits, 10);

      await serverDB.transaction(async (tx) => {
        // Update user_extensions
        await tx
          .update(userExtensions)
          .set({
            nextCreditGrantAt,
            planExpiresAt: newExpiresAt,
            updatedAt: now,
          })
          .where(eq(userExtensions.userId, agreement.userId));

        // Update agreement
        await tx
          .update(userAgreements)
          .set({
            deductFailCount: 0,
            deductFailReason: null,
            lastDeductOrderNo: orderNo,
            lastDeductStatus: 'success',
            lastDeductTime: now,
            nextDeductDate,
            updatedAt: now,
          })
          .where(eq(userAgreements.id, agreement.id));

        // Reset user balance
        await tx
          .update(userBalances)
          .set({
            balance: String(credits),
            updatedAt: now,
          })
          .where(eq(userBalances.userId, agreement.userId));

        // Mark old subscription records as inactive
        await tx
          .update(userSubscriptionHistory)
          .set({
            isActive: false,
          })
          .where(
            and(
              eq(userSubscriptionHistory.userId, agreement.userId),
              eq(userSubscriptionHistory.isActive, true),
            ),
          );

        // Write subscription history
        await tx.insert(userSubscriptionHistory).values({
          autoRenew: true,
          billingInterval,
          createdAt: now,
          endedAt: newExpiresAt,
          id: crypto.randomUUID(),
          isActive: true,
          orderNo,
          planId: plan.id,
          planName: plan.name,
          planType: plan.type,
          price: amount,
          slug: plan.slug,
          startedAt: now,
          status: 'active',
          subscriptionType: 'recurring',
          userId: agreement.userId,
        });

        // Write transaction record
        await tx.insert(userTransactions).values({
          amount: String(credits),
          balanceAfter: String(credits),
          category: 'AUTO_RENEWAL',
          createdAt: now,
          id: crypto.randomUUID(),
          metadata: {
            agreementNo: agreement.agreementNo,
            billingInterval,
            orderNo,
            planId: plan.id,
            planSlug: plan.slug,
          },
          type: 'SUBSCRIPTION_GRANT',
          userId: agreement.userId,
        });
      });

      console.log(`[AutoDeduct] Success: user=${agreement.userId}, orderNo=${orderNo}`);
      return { success: true };
    } else {
      // Deduction failed
      const failCount = (agreement.deductFailCount || 0) + 1;

      await serverDB
        .update(userAgreements)
        .set({
          deductFailCount: failCount,
          deductFailReason: result.errorMessage || result.errorCode || 'Unknown error',
          lastDeductOrderNo: orderNo,
          lastDeductStatus: 'failed',
          lastDeductTime: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userAgreements.id, agreement.id));

      console.log(
        `[AutoDeduct] Failed: user=${agreement.userId}, reason=${result.errorMessage}, failCount=${failCount}`,
      );
      return { reason: result.errorMessage, success: false };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[AutoDeduct] Error: user=${agreement.userId}, error=${errorMessage}`);

    await serverDB
      .update(userAgreements)
      .set({
        deductFailCount: (agreement.deductFailCount || 0) + 1,
        deductFailReason: errorMessage,
        lastDeductStatus: 'failed',
        lastDeductTime: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userAgreements.id, agreement.id));

    return { reason: errorMessage, success: false };
  }
}

/**
 * Downgrade user to free plan after deduction failures
 */
async function downgradeToFree(agreement: any, plan: any): Promise<void> {
  console.log(`[AutoDeduct] Downgrading user to free: userId=${agreement.userId}`);

  const now = new Date();

  // Get free plan
  const freePlanResult = await serverDB
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.slug, 'free'))
    .limit(1);

  if (!freePlanResult || freePlanResult.length === 0) {
    console.error('[AutoDeduct] Free plan not found');
    return;
  }

  const freePlan = freePlanResult[0];
  const freeCredits = Number.parseInt(freePlan.credits, 10);

  // Calculate next credit grant date (free users also get monthly reset)
  const nextCreditGrantAt = new Date(now);
  nextCreditGrantAt.setMonth(nextCreditGrantAt.getMonth() + 1);

  await serverDB.transaction(async (tx) => {
    // Update user_extensions - downgrade to free
    await tx
      .update(userExtensions)
      .set({
        autoRenew: false,
        billingInterval: null,
        currentAgreementId: null,
        currentPlan: 'free',
        downgradeAt: now,
        downgradeReason: 'deduct_failed',
        durationMonths: null,
        nextCreditGrantAt,
        planExpiresAt: null, // Free plan doesn't expire
        planId: freePlan.id,
        previousPlanName: plan.name,
        previousPlanSlug: plan.slug,
        subscriptionType: 'recurring',
        updatedAt: now,
      })
      .where(eq(userExtensions.userId, agreement.userId));

    // Update agreement status
    await tx
      .update(userAgreements)
      .set({
        status: 'unsigned',
        unsignReason: 'expired',
        unsignTime: now,
        updatedAt: now,
      })
      .where(eq(userAgreements.id, agreement.id));

    // Mark old subscription records as inactive
    await tx
      .update(userSubscriptionHistory)
      .set({
        isActive: false,
      })
      .where(
        and(
          eq(userSubscriptionHistory.userId, agreement.userId),
          eq(userSubscriptionHistory.isActive, true),
        ),
      );

    // Write subscription history - expired
    await tx.insert(userSubscriptionHistory).values({
      autoRenew: false,
      billingInterval: agreement.billingInterval,
      createdAt: now,
      endedAt: now,
      id: crypto.randomUUID(),
      isActive: false,
      planId: plan.id,
      planName: plan.name,
      planType: plan.type,
      price: 0,
      slug: plan.slug,
      startedAt: now,
      status: 'expired',
      subscriptionType: 'recurring',
      userId: agreement.userId,
    });

    // Reset balance to free plan credits
    await tx
      .update(userBalances)
      .set({
        balance: String(freeCredits),
        updatedAt: now,
      })
      .where(eq(userBalances.userId, agreement.userId));

    // Write transaction record
    await tx.insert(userTransactions).values({
      amount: String(freeCredits),
      balanceAfter: String(freeCredits),
      category: 'SUBSCRIPTION_EXPIRED',
      createdAt: now,
      id: crypto.randomUUID(),
      metadata: {
        newPlan: 'free',
        previousPlan: plan.slug,
        reason: 'deduct_failed',
      },
      type: 'SUBSCRIPTION_GRANT',
      userId: agreement.userId,
    });
  });

  console.log(`[AutoDeduct] User downgraded to free: userId=${agreement.userId}`);
}

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (token !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[AutoDeduct] Starting auto deduction job...');

    // Initialize Alipay cycle channel
    const alipayConfig = {
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',
      appId: process.env.ALIPAY_APP_ID || '',
      notifyUrl: process.env.ALIPAY_NOTIFY_URL || '',
      privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
      sandbox: process.env.ALIPAY_SANDBOX === 'true',
    };

    if (!alipayConfig.appId || !alipayConfig.privateKey || !alipayConfig.alipayPublicKey) {
      console.error('[AutoDeduct] Alipay configuration is incomplete');
      return NextResponse.json({ error: 'Alipay not configured' }, { status: 500 });
    }

    const cycleChannel = new AlipayCycleChannel(alipayConfig);

    // Get current hour to determine if this is first or second attempt
    const currentHour = getChinaHour();
    const isSecondAttempt = currentHour >= 12;

    console.log(
      `[AutoDeduct] Current hour (China): ${currentHour}, isSecondAttempt: ${isSecondAttempt}`,
    );

    // Get today's date string
    const today = new Date().toISOString().split('T')[0];

    // Find agreements that need deduction today
    const agreementsToDeduct = await serverDB
      .select({
        agreement: userAgreements,
        plan: subscriptionPlans,
      })
      .from(userAgreements)
      .innerJoin(subscriptionPlans, eq(userAgreements.planId, subscriptionPlans.id))
      .where(
        and(
          eq(userAgreements.status, 'signed'),
          lte(userAgreements.nextDeductDate, today),
          // For first attempt: only those not yet attempted today
          // For second attempt: those that failed on first attempt
          isSecondAttempt
            ? and(
                eq(userAgreements.lastDeductStatus, 'failed'),
                sql`DATE(${userAgreements.lastDeductTime}) = ${today}`,
              )
            : sql`(${userAgreements.lastDeductStatus} IS NULL OR ${userAgreements.lastDeductStatus} != 'failed' OR DATE(${userAgreements.lastDeductTime}) != ${today})`,
        ),
      );

    console.log(`[AutoDeduct] Found ${agreementsToDeduct.length} agreements to process`);

    let successCount = 0;
    let failCount = 0;
    let downgradeCount = 0;

    for (const { agreement, plan } of agreementsToDeduct) {
      const result = await processDeduction(cycleChannel, agreement, plan, isSecondAttempt);

      if (result.success) {
        successCount++;
      } else {
        failCount++;

        // If this is second attempt and still failed, downgrade to free
        if (isSecondAttempt) {
          await downgradeToFree(agreement, plan);
          downgradeCount++;
        }
      }
    }

    console.log(
      `[AutoDeduct] Completed: success=${successCount}, fail=${failCount}, downgrade=${downgradeCount}`,
    );

    return NextResponse.json({
      downgraded: downgradeCount,
      failed: failCount,
      isSecondAttempt,
      processed: agreementsToDeduct.length,
      success: true,
      successful: successCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[AutoDeduct] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      },
      { status: 500 },
    );
  }
}

/**
 * Vercel Cron configuration (vercel.json):
 *
 * {
 *   "crons": [
 *     {
 *       "path": "/api/cron/auto-deduct",
 *       "schedule": "0 1,4 * * *"  // 09:00 and 12:00 China time (UTC+8)
 *     }
 *   ]
 * }
 */
