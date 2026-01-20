import { sql } from 'drizzle-orm';
import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

// Main project user extension table - manages subscription information and extension fields
export const userExtensions = pgTable(
    'user_extensions',
    {


        accessedAt: timestamp('accessed_at').defaultNow(),






        // Suspension time
        // Admin notes
        adminNotes: text('admin_notes'),













        clerkCreatedAt: timestamp('clerk_created_at'),
















        // Admin notes
        // Timestamp
        createdAt: timestamp('created_at').defaultNow().notNull(),









        // References main project users table users.id
        // Subscription plan information
        currentPlan: text('current_plan').default('free'),
        // Last usage reset time
        // Extension feature toggles
        features: jsonb('features').default({}).notNull(),








        id: text('id')
            .primaryKey()
            .default(sql`gen_random_uuid()`),




        interests: text('interests').array(),




        isOnboarded: boolean('is_onboarded').default(false),




        // Extension feature configuration
        // Account status
        isSuspended: boolean('is_suspended').default(false),









        lastUsageReset: timestamp('last_usage_reset').defaultNow(),


















        // Preset plan ID for next billing cycle (used for mid-cycle downgrade or cancellation)
        nextPlanId: text('next_plan_id'),



















        onboarding: jsonb('onboarding'),


        // free, basic, pro, enterprise
        planExpiresAt: timestamp('plan_expires_at'),

        planId: text('plan_id'),








        preference: jsonb('preference'),







        // Whether account is suspended
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

// Subscription history table
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

    slug: text('slug'),










    // Plan features
    // Time information
    startedAt: timestamp('started_at').defaultNow().notNull(),










    status: text('status').default('active').notNull(),











    // Payment method
    transactionId: text('transaction_id'),


    userId: text('user_id').notNull(),
});
