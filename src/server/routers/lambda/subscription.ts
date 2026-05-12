import { authedProcedure, publicProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { paymentOrders, subscriptionPlans, userExtensions } from '@lobechat/database';
import { and, asc, desc, eq } from 'drizzle-orm';

// Features structure from plan document
export interface PlanFeatures {
  capabilities?: {
    custom_api?: boolean;
    unlimited_messages?: boolean;
  };
  cloud_services?: {
    global_sync?: boolean;
    unlimited_history?: boolean;
    web_search?: boolean;
  };
  display?: {
    description?: string;
    model_estimates?: Array<{
      count: string;
      model: string;
    }>;
  };
  resources?: {
    credits_per_month?: string;
    file_storage_gb?: string;
    vector_storage?: string;
    vector_storage_display?: string;
  };
  support?: {
    level?: string;
  };
}

export interface PlanResponse {
  credits: string;
  displayOrder: number;
  features: PlanFeatures;
  id: string;
  isPopular: boolean;
  monthlyPrice: number;
  name: string;
  slug: string;
  storageLimit: number;
  type: 'individual' | 'team';
  vectorLimit: number;
  yearlyPrice: number | null;
}

const subscriptionProcedure = publicProcedure.use(serverDatabase);
const authedSubscriptionProcedure = authedProcedure.use(serverDatabase);

export const subscriptionRouter = router({
  
  /**
   * Get current user's subscription status
   * Requires authentication
   */
getCurrentPlan: authedSubscriptionProcedure.query(async ({ ctx }) => {
    // Query user extension to get current plan info
    const userExt = await ctx.serverDB
      .select()
      .from(userExtensions)
      .where(eq(userExtensions.userId, ctx.userId))
      .limit(1);

    if (!userExt || userExt.length === 0) {
      return null;
    }

    const user = userExt[0];

    // If user has a planId, fetch the full plan details
    if (user.planId) {
      const plan = await ctx.serverDB
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, user.planId))
        .limit(1);

      if (plan && plan.length > 0) {
        // Query the most recent paid order for this user's current plan to get paidAmount and planValue
        const recentOrder = await ctx.serverDB
          .select({
            amount: paymentOrders.amount,
            planValue: paymentOrders.planValue,
          })
          .from(paymentOrders)
          .where(
            and(
              eq(paymentOrders.userId, ctx.userId),
              eq(paymentOrders.planId, user.planId),
              eq(paymentOrders.status, 'paid'),
            ),
          )
          .orderBy(desc(paymentOrders.paidAt))
          .limit(1);

        const paidAmount = recentOrder.length > 0 ? recentOrder[0].amount : 0;
        const planValue = recentOrder.length > 0 ? recentOrder[0].planValue : undefined;

        return {
          autoRenew: user.autoRenew ?? false,
          billingInterval: user.billingInterval,
          currentAgreementId: user.currentAgreementId,
          downgradeAt: user.downgradeAt,
          downgradeReason: user.downgradeReason,
          durationMonths: user.durationMonths,
          features: plan[0].features,
          nextCreditGrantAt: user.nextCreditGrantAt,
          paidAmount, // Actual paid amount (in cents) - for display only
          planExpiresAt: user.planExpiresAt,
          planId: user.planId,
          planName: plan[0].name,
          planSlug: user.currentPlan,
          planType: plan[0].type,
          planValue, // Plan value (in cents) - used for residual value calculation
          previousPlanName: user.previousPlanName,
          previousPlanSlug: user.previousPlanSlug,
          subscriptionType: user.subscriptionType || 'recurring',
        };
      }
    }

    // Fallback: user doesn't have a plan or plan not found
    return {
      autoRenew: user.autoRenew ?? false,
      billingInterval: null,
      currentAgreementId: user.currentAgreementId,
      downgradeAt: user.downgradeAt,
      downgradeReason: user.downgradeReason,
      durationMonths: null,
      features: {},
      nextCreditGrantAt: null,
      paidAmount: 0,
      planExpiresAt: user.planExpiresAt,
      planId: null,
      planName: 'Free',
      planSlug: user.currentPlan || 'free',
      planType: 'individual',
      planValue: undefined,
      previousPlanName: user.previousPlanName,
      previousPlanSlug: user.previousPlanSlug,
      subscriptionType: 'recurring',
    };
  }),

  
  /**
   * Get all active subscription plans
   * Public endpoint - no authentication required
   */
getPlans: subscriptionProcedure.query(async ({ ctx }): Promise<PlanResponse[]> => {
    const plans = await ctx.serverDB
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(asc(subscriptionPlans.displayOrder));

    return plans.map((plan) => ({
      credits: plan.credits,
      displayOrder: plan.displayOrder,
      features: plan.features as PlanFeatures,
      id: plan.id,
      isPopular: plan.isPopular,
      monthlyPrice: plan.monthlyPrice,
      name: plan.name,
      slug: plan.slug,
      storageLimit: plan.storageLimit,
      type: plan.type as 'individual' | 'team',
      vectorLimit: plan.vectorLimit,
      yearlyPrice: plan.yearlyPrice,
    }));
  }),
});
