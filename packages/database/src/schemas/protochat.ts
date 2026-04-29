/* eslint-disable sort-keys-fix/sort-keys-fix */
import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';

import { createdAt, timestamptz, updatedAt } from './_helpers';

/**
 * ProtoChat underlying provider configuration
 * Stores API configurations for underlying providers such as OpenRouter and DeepSeek
 */
export const protochatProviders = pgTable(
  'protochat_providers',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    // 'aggregator' = aggregation platform (e.g. OpenRouter), 'direct' = direct provider (e.g. DeepSeek)
    type: varchar('type', { length: 50 }).notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    // Priority used for ordering when selecting providers
    priority: integer('priority').default(0),

    // Provider alias used to generate model IDs, hiding the real provider name
    // Format examples: a1, b2, c3 — used in model IDs as: protochat::{alias}::{modelId}
    alias: varchar('alias', { length: 10 }),

    // API configuration
    apiKey: text('api_key'),
    baseUrl: varchar('base_url', { length: 500 }),
    // Optional custom endpoint
    apiEndpoint: varchar('api_endpoint', { length: 500 }),

    // Pricing sync configuration
    // 'api' = fetch from provider API, 'model_bank' = fetch from Model-Bank, 'manual' = manual configuration
    pricingSyncStrategy: varchar('pricing_sync_strategy', { length: 50 }),
    pricingApiUrl: varchar('pricing_api_url', { length: 500 }),

    // Other configuration (JSON format, extensible)
    settings: jsonb('settings'),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('protochat_providers_enabled_idx').on(table.enabled),
    index('protochat_providers_priority_idx').on(table.priority),
    unique('protochat_providers_alias_unique').on(table.alias),
  ],
);

export type ProtochatProviderInsert = typeof protochatProviders.$inferInsert;
export type ProtochatProviderSelect = typeof protochatProviders.$inferSelect;

/**
 * ProtoChat model list
 * Stores available models for the ProtoChat provider and their mapping to underlying providers
 */
export const protochatModels = pgTable(
  'protochat_models',
  {
    // ProtoChat model ID, format: 'protochat::gpt-4o'
    id: varchar('id', { length: 200 }).primaryKey(),
    // Original model ID, format: 'openrouter::openai/gpt-4o'
    originalId: varchar('original_id', { length: 200 }).notNull(),
    // Original provider ID, e.g. 'openrouter', 'deepseek'
    originalProvider: varchar('original_provider', { length: 64 }).notNull(),
    displayName: varchar('display_name', { length: 200 }).notNull(),
    // Model type: 'chat', 'image', 'embedding'
    type: varchar('type', { length: 20 }).notNull(),
    // Whether enabled in the backend (controls user visibility)
    enabled: boolean('enabled').default(false).notNull(),

    // Model capabilities: {functionCall, vision, reasoning, search, files, etc}
    capabilities: jsonb('capabilities'),
    contextTokens: integer('context_tokens'),
    maxOutput: integer('max_output'),

    // Model parameter schema
    parameters: jsonb('parameters'),
    // Special settings
    settings: jsonb('settings'),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('protochat_models_original_provider_idx').on(table.originalProvider),
    index('protochat_models_enabled_idx').on(table.enabled),
    index('protochat_models_type_idx').on(table.type),
    unique('protochat_models_original_id_unique').on(table.originalId),
  ],
);

export type ProtochatModelInsert = typeof protochatModels.$inferInsert;
export type ProtochatModelSelect = typeof protochatModels.$inferSelect;

/**
 * ProtoChat model pricing
 * Stores cost price and user price for each model
 */
export const protochatModelPricing = pgTable(
  'protochat_model_pricing',
  {
    id: serial('id').primaryKey(),
    // References protochat_models.id
    modelId: varchar('model_id', { length: 200 }).notNull(),

    // Cost price (USD per million tokens)
    costInputPrice: decimal('cost_input_price', { precision: 15, scale: 4 }).notNull(),
    costOutputPrice: decimal('cost_output_price', { precision: 15, scale: 4 }).notNull(),

    // Original currency: 'USD', 'CNY'
    currency: varchar('currency', { length: 10 }).default('USD'),
    // Pricing source: 'api', 'model_bank', 'manual'
    priceSource: varchar('price_source', { length: 50 }),
    // Whether this is a free model
    isFree: boolean('is_free').default(false),

    // Last sync time
    syncedAt: timestamptz('synced_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    unique('protochat_pricing_model_id_unique').on(table.modelId),
    index('protochat_pricing_model_id_idx').on(table.modelId),
    index('protochat_pricing_synced_at_idx').on(table.syncedAt),
  ],
);

export type ProtochatModelPricingInsert = typeof protochatModelPricing.$inferInsert;
export type ProtochatModelPricingSelect = typeof protochatModelPricing.$inferSelect;

/**
 * ProtoChat global settings
 * Stores global configuration such as pricing multipliers
 */
export const protochatSettings = pgTable('protochat_settings', {
  // Setting ID, e.g. 'pricing_multiplier'
  id: varchar('id', { length: 50 }).primaryKey(),
  // Setting value
  value: decimal('value', { precision: 10, scale: 4 }).notNull(),
  description: varchar('description', { length: 500 }),
  updatedAt: updatedAt(),
});

export type ProtochatSettingsInsert = typeof protochatSettings.$inferInsert;
export type ProtochatSettingsSelect = typeof protochatSettings.$inferSelect;

/**
 * ProtoChat usage logs
 * Records detailed logs of user usage of ProtoChat models for analytics and auditing
 */
export const protochatUsageLogs = pgTable(
  'protochat_usage_logs',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    modelId: varchar('model_id', { length: 200 }).notNull(),
    originalProvider: varchar('original_provider', { length: 64 }).notNull(),

    // Token usage
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    totalTokens: integer('total_tokens').notNull(),

    // Cost record
    costPrice: decimal('cost_price', { precision: 15, scale: 4 }),
    userPrice: decimal('user_price', { precision: 15, scale: 4 }),

    // Request information
    requestId: varchar('request_id', { length: 100 }),

    createdAt: createdAt(),
  },
  (table) => [
    index('protochat_usage_user_id_idx').on(table.userId),
    index('protochat_usage_model_id_idx').on(table.modelId),
    index('protochat_usage_created_at_idx').on(table.createdAt),
    index('protochat_usage_original_provider_idx').on(table.originalProvider),
  ],
);

export type ProtochatUsageLogInsert = typeof protochatUsageLogs.$inferInsert;
export type ProtochatUsageLogSelect = typeof protochatUsageLogs.$inferSelect;
