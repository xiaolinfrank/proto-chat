/* eslint-disable sort-keys-fix/sort-keys-fix */
import {
  decimal,
  index,
  integer,
  pgTable,
  serial,
  text,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { createdAt, timestamptz, updatedAt } from './_helpers';

/**
 * System-level Embedding configuration (single-row table)
 * Stores the globally used embedding model configuration
 */
export const systemEmbeddingConfig = pgTable('system_embedding_config', {
  // Primary key, fixed as 'default' (single-row table)
  id: varchar('id', { length: 50 }).primaryKey().default('default'),
  // Provider ID, e.g. 'openrouter', 'openai'
  providerId: varchar('provider_id', { length: 64 }).notNull(),
  // Model ID, e.g. 'qwen/qwen3-embedding-4b'
  modelId: varchar('model_id', { length: 200 }).notNull(),
  // Display name
  displayName: varchar('display_name', { length: 200 }),

  // API configuration (encrypted storage)
  apiKey: text('api_key'),
  baseUrl: varchar('base_url', { length: 500 }),
  modelsSyncUrl: varchar('models_sync_url', { length: 500 }),

  // Pricing (credits per million tokens)
  inputPrice: decimal('input_price', { precision: 15, scale: 4 }),
  currency: varchar('currency', { length: 10 }).default('USD'),

  // Model metadata
  contextTokens: integer('context_tokens'),
  dimensions: integer('dimensions').default(1024),

  // Last sync time
  lastSyncedAt: timestamptz('last_synced_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type SystemEmbeddingConfigInsert = typeof systemEmbeddingConfig.$inferInsert;
export type SystemEmbeddingConfigSelect = typeof systemEmbeddingConfig.$inferSelect;

/**
 * Available Embedding model list
 * Stores embedding model information synced from providers, for selection purposes only
 */
export const systemEmbeddingModels = pgTable(
  'system_embedding_models',
  {
    id: serial('id').primaryKey(),
    // Model ID, e.g. 'qwen/qwen3-embedding-4b'
    modelId: varchar('model_id', { length: 200 }).notNull(),
    // Display name
    displayName: varchar('display_name', { length: 200 }).notNull(),
    // Provider ID
    providerId: varchar('provider_id', { length: 64 }).notNull(),

    // Model capabilities
    dimensions: integer('dimensions').default(1024),
    contextTokens: integer('context_tokens'),

    // Pricing info (fetched from sync API)
    inputPrice: decimal('input_price', { precision: 15, scale: 4 }),
    currency: varchar('currency', { length: 10 }).default('USD'),

    // Sync time
    syncedAt: timestamptz('synced_at'),
    createdAt: createdAt(),
  },
  (table) => [
    unique('system_embedding_models_model_id_unique').on(table.modelId),
    index('idx_system_embedding_models_provider').on(table.providerId),
  ],
);

export type SystemEmbeddingModelInsert = typeof systemEmbeddingModels.$inferInsert;
export type SystemEmbeddingModelSelect = typeof systemEmbeddingModels.$inferSelect;

/**
 * Embedding usage logs
 * Records detailed logs of user embedding usage for cost analysis and auditing
 */
export const embeddingUsageLogs = pgTable(
  'embedding_usage_logs',
  {
    id: serial('id').primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    modelId: varchar('model_id', { length: 200 }).notNull(),
    providerId: varchar('provider_id', { length: 64 }).notNull(),

    // Token usage
    inputTokens: integer('input_tokens').notNull(),
    totalTokens: integer('total_tokens').notNull(),

    // Cost record (using scale: 8 to support very small cost values, e.g. $0.00000001)
    costPrice: decimal('cost_price', { precision: 15, scale: 8 }),
    userPrice: decimal('user_price', { precision: 15, scale: 8 }),

    // Operation context
    operationType: varchar('operation_type', { length: 50 }), // 'file_chunking', 'semantic_search', 'rag_eval'
    fileId: text('file_id'), // If file embedding (corresponds to files.id - text type)
    chunkCount: integer('chunk_count'), // Number of chunks for batch embedding

    createdAt: createdAt(),
  },
  (table) => [
    index('idx_embedding_usage_user').on(table.userId),
    index('idx_embedding_usage_created').on(table.createdAt),
  ],
);

export type EmbeddingUsageLogInsert = typeof embeddingUsageLogs.$inferInsert;
export type EmbeddingUsageLogSelect = typeof embeddingUsageLogs.$inferSelect;
