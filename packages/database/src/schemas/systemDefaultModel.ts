/* eslint-disable sort-keys-fix/sort-keys-fix */
import { pgTable, varchar } from 'drizzle-orm/pg-core';

import { createdAt, updatedAt } from './_helpers';

/**
 * System-level default model configuration (single-row table)
 * Stores the globally used default AI model configuration
 */
export const systemDefaultModelConfig = pgTable('system_default_model_config', {
  // Primary key, fixed as 'default' (single-row table)
  id: varchar('id', { length: 50 }).primaryKey().default('default'),
  // Model ID, e.g. 'gpt-4o', 'claude-3-opus'
  modelId: varchar('model_id', { length: 200 }),
  // Display name
  displayName: varchar('display_name', { length: 200 }),
  // Provider ID
  providerId: varchar('provider_id', { length: 64 }),
  // Provider name
  providerName: varchar('provider_name', { length: 200 }),

  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type SystemDefaultModelConfigInsert = typeof systemDefaultModelConfig.$inferInsert;
export type SystemDefaultModelConfigSelect = typeof systemDefaultModelConfig.$inferSelect;
