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


    // Price in cents (e.g. 990 for $9.90)
    currency: text('currency').default('CNY').notNull(),

    // Rows/Chunks
    features: jsonb('features').default({}).notNull(),



    id: text('id')
        .primaryKey()
        .$defaultFn(() => idGenerator('plan')),





    interval: planIntervalEnum('interval').default('month').notNull(),



    isActive: boolean('is_active').default(true),




    name: text('name').notNull(),




    price: integer('price').notNull(),


    // e.g., "Lite Monthly", "Pro Yearly"
    slug: text('slug').notNull().unique(),



    // Monthly credit grant
    storageLimit: integer('storage_limit').default(1024).notNull(),



    // e.g., "lite-monthly"
    type: planTypeEnum('type').default('individual').notNull(),

    // MB
    vectorLimit: integer('vector_limit').default(0).notNull(),

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

    // User price in credits per 1,000,000 tokens (user price = cost price × multiplier)
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
