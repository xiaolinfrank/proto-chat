import {
    boolean,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    numeric,
    uniqueIndex
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { idGenerator } from '../utils/idGenerator';
import { timestamps } from './_helpers';

// Plan interval enum
export const planIntervalEnum = pgEnum('plan_interval', ['month', 'year']);

// Plan type enum
export const planTypeEnum = pgEnum('plan_type', ['individual', 'team']);

// Subscription Plans
export const subscriptionPlans = pgTable('subscription_plans', {

    credits: numeric('credits', { precision: 12, scale: 2 }).default('0').notNull(),


    // Currency
    currency: text('currency').default('CNY').notNull(),

    // Display order for frontend
    displayOrder: integer('display_order').default(0).notNull(),

    // Rows/Chunks
    features: jsonb('features').default({}).notNull(),



    id: text('id')
        .primaryKey()
        .$defaultFn(() => idGenerator('plan')),





    isActive: boolean('is_active').default(true),

    // Popular plan badge
    isPopular: boolean('is_popular').default(false).notNull(),



    // Monthly price in cents (e.g. 14900 for ¥149.00)
    monthlyPrice: integer('monthly_price').notNull(),


    name: text('name').notNull(),


    // e.g., "lite", "pro"
    slug: text('slug').notNull().unique(),



    // Monthly credit grant
    storageLimit: integer('storage_limit').default(1024).notNull(),



    // e.g., "individual", "team"
    type: planTypeEnum('type').default('individual').notNull(),

    // MB
    vectorLimit: integer('vector_limit').default(0).notNull(),

    // Yearly price in cents (NULL = not available for yearly billing)
    yearlyPrice: integer('yearly_price'),

    ...timestamps,
});

// Model Pricing Coefficients
export const modelPricings = pgTable('model_pricings', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => idGenerator('mp')),

    // Cost price in credits per 1,000,000 tokens
    inputPrice: numeric('input_price', { precision: 15, scale: 6 }).default('0').notNull(),

    model: text('model').notNull(),

    // Cost price in credits per 1,000,000 tokens
    outputPrice: numeric('output_price', { precision: 15, scale: 6 }).default('0').notNull(),

    // Price in credits per request
    perRequestPrice: numeric('per_request_price', { precision: 15, scale: 6 }).default('0').notNull(),

    // e.g. "openai"
    provider: text('provider').notNull(),

    // Sub-provider (only for ProtoChat), e.g. "openrouter", "deepseek"
    subProvider: text('sub_provider'),

    // User price in credits per 1,000,000 tokens (= cost price × coefficient)
    // Pre-calculated to avoid runtime computation
    userInputPrice: numeric('user_input_price', { precision: 15, scale: 6 }).default('0').notNull(),
    userOutputPrice: numeric('user_output_price', { precision: 15, scale: 6 }).default('0').notNull(),

    // Memo for admin
    memo: text('memo'),

    ...timestamps,
}, (table) => {
    return {
        modelProviderSubProviderIdx: uniqueIndex('model_provider_subprovider_idx').on(
            table.model,
            table.provider,
            table.subProvider
        ),
    };
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans);
export const insertModelPricingSchema = createInsertSchema(modelPricings);

export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type SubscriptionPlanItem = typeof subscriptionPlans.$inferSelect;
export type NewModelPricing = typeof modelPricings.$inferInsert;
export type ModelPricingItem = typeof modelPricings.$inferSelect;
