import { sql } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

// Main project user extension table - manages subscription info and extended fields
export const userExtensions = pgTable(
    'user_extensions',
    {


        accessedAt: timestamp('accessed_at').defaultNow(),






        // Suspension time
        // Admin notes
        adminNotes: text('admin_notes'),

        // Current billing interval: 'month' | 'year', NULL for free users
        billingInterval: text('billing_interval'),

        // Subscription type: 'recurring' (auto-renewal) | 'onetime' (one-time payment)
        subscriptionType: text('subscription_type').default('recurring'),

        // Duration in months for one-time payment (1, 3, 6, 12), NULL for recurring subscriptions
        durationMonths: integer('duration_months'),













        clerkCreatedAt: timestamp('clerk_created_at'),
















        // Admin notes
        // Timestamps
        createdAt: timestamp('created_at').defaultNow().notNull(),









        // References main project user table users.id
        // Plan subscription info
        currentPlan: text('current_plan').default('free'),
        // Last usage reset time
        // Feature flags
        features: jsonb('features').default({}).notNull(),








        id: text('id')
            .primaryKey()
            .default(sql`gen_random_uuid()`),




        interests: text('interests').array(),




        isOnboarded: boolean('is_onboarded').default(false),




        // Extended feature configuration
        // Account status
        isSuspended: boolean('is_suspended').default(false),









        lastUsageReset: timestamp('last_usage_reset').defaultNow(),


















        // Next credit grant time
        nextCreditGrantAt: timestamp('next_credit_grant_at'),

        // Preset plan ID for the next billing cycle (used for mid-cycle downgrade or cancellation)
        nextPlanId: text('next_plan_id'),

        // ============ Agreement Information ============
        // Currently active agreement ID
        currentAgreementId: text('current_agreement_id'),
        // Auto-renewal status: true=enabled, false=disabled
        autoRenew: boolean('auto_renew').default(false),

        // ============ Downgrade Information ============
        // Downgrade reason: deduct_failed (payment failed), user_unsign (user canceled agreement), expired (subscription expired)
        downgradeReason: text('downgrade_reason'),
        // Plan slug before downgrade
        previousPlanSlug: text('previous_plan_slug'),
        // Plan name before downgrade
        previousPlanName: text('previous_plan_name'),
        // Downgrade time
        downgradeAt: timestamp('downgrade_at'),



















        onboarding: jsonb('onboarding'),


        // free, basic, pro, enterprise
        planExpiresAt: timestamp('plan_expires_at'),

        planId: text('plan_id'),








        preference: jsonb('preference'),







        // Whether suspended
        suspendReason: text('suspend_reason'),






        // Suspension reason
        suspendedAt: timestamp('suspended_at'),



        updatedAt: timestamp('updated_at').defaultNow().notNull(),
        userId: text('user_id').unique().notNull(),
    },
    (table) => ({
        // Unique index
        userIdIdx: uniqueIndex('user_extension_user_id_idx').on(table.userId),
    }),
);

// Plan subscription history table
export const userSubscriptionHistory = pgTable('user_subscription_history', {



    // active, canceled, expired, past_due, upgraded
    autoRenew: boolean('auto_renew').default(true).notNull(),








    // Transaction ID
    createdAt: timestamp('created_at').defaultNow().notNull(),





    // Start time
    endedAt: timestamp('ended_at'),






    features: jsonb('features').default({}).notNull(),










    id: text('id')
        .primaryKey()
        .default(sql`gen_random_uuid()`),

    // End time
    isActive: boolean('is_active').default(true).notNull(),
    // Whether active
    // Payment information
    paymentMethod: text('payment_method'),










    planId: text('plan_id'),










    // Plan type
    planName: text('plan_name').notNull(),












    // References main project user ID
    planType: text('plan_type').notNull(),

    // Plan name
    price: integer('price').default(0),

    // Billing interval
    billingInterval: text('billing_interval'),

    // Subscription type: 'recurring' (auto-renewal) | 'onetime' (one-time payment)
    subscriptionType: text('subscription_type').default('recurring'),

    // Duration in months for one-time payment (1, 3, 6, 12), NULL for recurring subscriptions
    durationMonths: integer('duration_months'),

    // Associated order number
    orderNo: varchar('order_no', { length: 64 }),

    slug: text('slug'),










    // Plan features
    // Time information
    startedAt: timestamp('started_at').defaultNow().notNull(),










    status: text('status').default('active').notNull(),











    // Payment method
    transactionId: text('transaction_id'),


    userId: text('user_id').notNull(),
});
