/**
 * Subscription Maintenance Cron Job
 *
 * Handles:
 * 1. Monthly credit grants for active subscribers
 * 2. Subscription expiration processing (for one-time payments)
 *
 * IMPORTANT: This must run AFTER auto-deduct cron job!
 * - Auto-deduct runs at 09:00 and 12:00 Beijing time
 * - This job should run at 14:00 Beijing time (06:00 UTC)
 *
 * Run frequency: Daily at 06:00 UTC (14:00 Beijing time)
 * Vercel Cron: "0 6 * * *"
 */
import {
  serverDB,
  subscriptionPlans,
  userBalances,
  userExtensions,
  userSubscriptionHistory,
  userTransactions,
} from '@lobechat/database';
import { and, eq, lte, ne } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-key';

/**
 * Grant monthly credits to active subscribers
 * Includes both paid plans and free plan (free plan also gets monthly credit reset)
 */
async function grantMonthlyCredits() {
  const now = new Date();

  console.log('[Cron] Starting monthly credit grant...');

  // Find users due for credit grant (includes free plan users)
  const usersToGrant = await serverDB
    .select({
      currentPlan: userExtensions.currentPlan,
      isSuspended: userExtensions.isSuspended,
      nextCreditGrantAt: userExtensions.nextCreditGrantAt,
      planId: userExtensions.planId,
      userId: userExtensions.userId,
    })
    .from(userExtensions)
    .where(and(lte(userExtensions.nextCreditGrantAt, now), eq(userExtensions.isSuspended, false)));

  if (usersToGrant.length === 0) {
    console.log('[Cron] No users to grant credits');
    return { granted: 0 };
  }

  console.log(`[Cron] Found ${usersToGrant.length} users to grant credits`);

  let grantedCount = 0;

  for (const user of usersToGrant) {
    try {
      if (!user.planId) {
        console.warn(`[Cron] User ${user.userId} has no planId, skipping`);
        continue;
      }

      // Get plan credits
      const plan = await serverDB
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, user.planId))
        .limit(1);

      if (!plan || plan.length === 0) {
        console.warn(`[Cron] Plan ${user.planId} not found for user ${user.userId}`);
        continue;
      }

      const credits = Number.parseInt(plan[0].credits, 10);

      await serverDB.transaction(async (tx: typeof serverDB) => {
        // Reset user balance
        const existingBalance = await tx
          .select()
          .from(userBalances)
          .where(eq(userBalances.userId, user.userId))
          .limit(1);

        if (existingBalance && existingBalance.length > 0) {
          await tx
            .update(userBalances)
            .set({
              balance: String(credits),
              updatedAt: now,
            })
            .where(eq(userBalances.userId, user.userId));
        } else {
          await tx.insert(userBalances).values({
            balance: String(credits),
            createdAt: now,
            updatedAt: now,
            userId: user.userId,
          });
        }

        // Write transaction record
        await tx.insert(userTransactions).values({
          amount: String(credits),
          balanceAfter: String(credits),
          category: 'MONTHLY_GRANT',
          createdAt: now,
          id: crypto.randomUUID(),
          metadata: {
            grantType: 'monthly',
            planId: user.planId,
            planSlug: user.currentPlan,
          },
          type: 'SUBSCRIPTION_GRANT',
          userId: user.userId,
        });

        // Update next credit grant date (1 month later)
        const nextGrantDate = new Date(now);
        nextGrantDate.setMonth(nextGrantDate.getMonth() + 1);

        await tx
          .update(userExtensions)
          .set({
            nextCreditGrantAt: nextGrantDate,
            updatedAt: now,
          })
          .where(eq(userExtensions.userId, user.userId));
      });

      grantedCount++;
      console.log(`[Cron] Granted ${credits} credits to user ${user.userId}`);
    } catch (error) {
      console.error(`[Cron] Error granting credits to user ${user.userId}:`, error);
      // Continue with next user
    }
  }

  console.log(`[Cron] Monthly credit grant completed: ${grantedCount}/${usersToGrant.length}`);
  return { granted: grantedCount };
}

/**
 * Process expired subscriptions
 */
async function processExpirations() {
  const now = new Date();

  console.log('[Cron] Starting expiration processing...');

  // Find expired users
  const expiredUsers = await serverDB
    .select({
      currentPlan: userExtensions.currentPlan,
      planExpiresAt: userExtensions.planExpiresAt,
      planId: userExtensions.planId,
      userId: userExtensions.userId,
    })
    .from(userExtensions)
    .where(and(lte(userExtensions.planExpiresAt, now), ne(userExtensions.currentPlan, 'free')));

  if (expiredUsers.length === 0) {
    console.log('[Cron] No expired subscriptions');
    return { expired: 0 };
  }

  console.log(`[Cron] Found ${expiredUsers.length} expired subscriptions`);

  // Get free plan ID
  const freePlanResult = await serverDB
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.slug, 'free'))
    .limit(1);

  if (!freePlanResult || freePlanResult.length === 0) {
    console.error('[Cron] Free plan not found, cannot process expirations');
    return { error: 'Free plan not found', expired: 0 };
  }

  const freePlan = freePlanResult[0];
  let expiredCount = 0;

  for (const user of expiredUsers) {
    try {
      // Calculate next credit grant date (1 month from now, same day each month)
      const nextCreditGrantAt = new Date(now);
      nextCreditGrantAt.setMonth(nextCreditGrantAt.getMonth() + 1);

      await serverDB.transaction(async (tx: typeof serverDB) => {
        // Update user to free plan
        // Note: Set nextCreditGrantAt so free users continue to get monthly credit reset
        // Clear planExpiresAt since free plan doesn't expire
        await tx
          .update(userExtensions)
          .set({
            billingInterval: null,
            currentPlan: 'free',
            durationMonths: null,
            nextCreditGrantAt, // Free plan also gets monthly credit reset
            planExpiresAt: null, // Free plan doesn't expire
            planId: freePlan.id,
            subscriptionType: 'recurring', // Free is treated as recurring for credit grant
            updatedAt: now,
          })
          .where(eq(userExtensions.userId, user.userId));

        // Mark old subscription records as inactive
        await tx
          .update(userSubscriptionHistory)
          .set({
            isActive: false,
          })
          .where(
            and(
              eq(userSubscriptionHistory.userId, user.userId),
              eq(userSubscriptionHistory.isActive, true),
            ),
          );

        // Write expiration record to subscription history
        await tx.insert(userSubscriptionHistory).values({
          createdAt: now,
          endedAt: now,
          id: crypto.randomUUID(),
          isActive: false,
          planId: user.planId!,
          planName: 'Expired Plan',
          planType: 'individual',
          price: 0,
          slug: user.currentPlan!,
          startedAt: user.planExpiresAt!,
          status: 'expired',
          userId: user.userId,
        });

        // Reset balance to free plan credits
        const freeCredits = Number.parseInt(freePlan.credits, 10);

        await tx
          .update(userBalances)
          .set({
            balance: String(freeCredits),
            updatedAt: now,
          })
          .where(eq(userBalances.userId, user.userId));

        // Write transaction record
        await tx.insert(userTransactions).values({
          amount: String(freeCredits),
          balanceAfter: String(freeCredits),
          category: 'SUBSCRIPTION_EXPIRED',
          createdAt: now,
          id: crypto.randomUUID(),
          metadata: {
            newPlan: 'free',
            previousPlan: user.currentPlan,
          },
          type: 'SUBSCRIPTION_GRANT',
          userId: user.userId,
        });
      });

      expiredCount++;
      console.log(`[Cron] Downgraded user ${user.userId} to free plan`);
    } catch (error) {
      console.error(`[Cron] Error processing expiration for user ${user.userId}:`, error);
      // Continue with next user
    }
  }

  console.log(`[Cron] Expiration processing completed: ${expiredCount}/${expiredUsers.length}`);
  return { expired: expiredCount };
}

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (token !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Starting subscription maintenance...');

    // Run both tasks
    const [creditsResult, expirationsResult] = await Promise.all([
      grantMonthlyCredits(),
      processExpirations(),
    ]);

    console.log('[Cron] Subscription maintenance completed');

    return NextResponse.json({
      creditsGranted: creditsResult.granted,
      subscriptionsExpired: expirationsResult.expired,
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Error in subscription maintenance:', error);
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
 *       "path": "/api/cron/subscription",
 *       "schedule": "5 0 * * *"
 *     }
 *   ]
 * }
 *
 * Schedule explanation: "5 0 * * *" = Every day at 00:05 UTC
 */
