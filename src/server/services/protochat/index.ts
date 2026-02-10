import { and, eq, like } from 'drizzle-orm';

import {
  LobeChatDatabase,
  modelPricings,
  protochatModels,
  protochatProviders,
  protochatSettings,
  protochatUsageLogs,
} from '@lobechat/database';

import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';

/**
 * ProtoChat model mapping information
 */
export interface ProtoChatModelMapping {
  /** API key of the underlying provider */
  apiKey: string;
  /** Base URL of the underlying provider */
  baseUrl: string;
  /** Original model ID, e.g., 'openrouter::openai/gpt-4o' */
  originalId: string;
  /** Original provider ID, e.g., 'openrouter' */
  originalProvider: string;
  /** Model type: 'chat' | 'image' | 'embedding' */
  type: string;
}

/**
 * ProtoChat pricing information
 */
export interface ProtoChatPricing {
  /** Whether it is free */
  isFree: boolean;
  /** User price - input (credits per million tokens) */
  userInputPrice: number;
  /** User price - output (credits per million tokens) */
  userOutputPrice: number;
}

/**
 * ProtoChat Service
 *
 * Provides model mapping, pricing queries, usage logging, and other functionalities
 */
export class ProtoChatService {
  private readonly db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  /**
   * Get model mapping information
   * @param modelId ProtoChat model ID, supports full format 'protochat::a1::gpt-4o' or short format 'gpt-4o'
   */
  async getModelMapping(modelId: string): Promise<ProtoChatModelMapping> {
    // First try exact match
    let model = await this.db
      .select()
      .from(protochatModels)
      .where(eq(protochatModels.id, modelId))
      .limit(1);

    // If exact match fails, try fuzzy match (supports legacy model ID formats)
    if (!model.length && !modelId.startsWith('protochat::')) {
      // Try to match full IDs ending with this model ID (e.g., 'protochat::a1::gemini-2.5-flash' matches 'gemini-2.5-flash')
      model = await this.db
        .select()
        .from(protochatModels)
        .where(
          and(
            like(protochatModels.id, `%::${modelId}`),
            eq(protochatModels.enabled, true),
          ),
        )
        .limit(1);
    }

    if (!model.length) {
      throw new Error(`ProtoChat model not found: ${modelId}`);
    }

    const modelData = model[0];

    if (!modelData.enabled) {
      throw new Error(`ProtoChat model is disabled: ${modelId}`);
    }

    // 查询供应商
    const provider = await this.db
      .select()
      .from(protochatProviders)
      .where(eq(protochatProviders.id, modelData.originalProvider))
      .limit(1);

    if (!provider.length) {
      throw new Error(`ProtoChat provider not found: ${modelData.originalProvider}`);
    }

    const providerData = provider[0];

    if (!providerData.enabled) {
      throw new Error(`ProtoChat provider is disabled: ${modelData.originalProvider}`);
    }

    // Decrypt API Key
    let keyVaults: any = {};

    if (providerData.apiKey) {
      try {
        const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
        const { wasAuthentic, plaintext } = await gateKeeper.decrypt(providerData.apiKey);

        if (wasAuthentic && plaintext) {
          try {
            keyVaults = JSON.parse(plaintext);
          } catch (e) {
            console.error(
              `[ProtoChat] Failed to parse keyVaults JSON for ${modelData.originalProvider}:`,
              e,
            );
          }
        } else if (!wasAuthentic) {
          console.error(
            `[ProtoChat] Decryption authentication failed for ${modelData.originalProvider}. This usually means the encryption key is different from the one used to encrypt.`,
          );
        }
      } catch (error) {
        console.error(
          `[ProtoChat] Error during decryption for ${modelData.originalProvider}:`,
          error,
        );
      }
    }

    const apiKey = keyVaults.apiKey || '';
    let baseUrl = providerData.baseUrl || '';

    // Prioritize baseUrl or proxyUrl from keyVaults
    if (keyVaults.baseURL) {
      baseUrl = keyVaults.baseURL;
    } else if (keyVaults.proxyUrl) {
      baseUrl = keyVaults.proxyUrl;
    } else if (keyVaults.baseUrl) {
      baseUrl = keyVaults.baseUrl;
    }

    if (!apiKey) {
      throw new Error(`No API key found for provider ${modelData.originalProvider}`);
    }

    return {
      apiKey,
      baseUrl,
      originalId: modelData.originalId,
      originalProvider: modelData.originalProvider,
      type: modelData.type,
    };
  }

  /**
   * Convert model ID
   * Extract 'openai/gpt-4o' from 'openrouter::openai/gpt-4o'
   */
  convertModelId(originalId: string): string {
    const parts = originalId.split('::');
    return parts.at(-1) || originalId;
  }

  /**
   * Get model pricing (reads pre-calculated credit prices from model_pricings table)
   * @param modelId ProtoChat model ID
   */
  async getModelPricing(modelId: string): Promise<ProtoChatPricing | null> {
    const pricing = await this.db
      .select()
      .from(modelPricings)
      .where(
        and(
          eq(modelPricings.model, modelId),
          eq(modelPricings.provider, 'protochat'),
        ),
      )
      .limit(1);

    if (!pricing.length) {
      return null;
    }

    const pricingData = pricing[0];
    const userInputPrice = Number(pricingData.userInputPrice);
    const userOutputPrice = Number(pricingData.userOutputPrice);

    return {
      isFree: userInputPrice === 0 && userOutputPrice === 0,
      userInputPrice,
      userOutputPrice,
    };
  }

  /**
   * Get pricing multiplier
   */
  async getPricingMultiplier(): Promise<number> {
    const setting = await this.db
      .select()
      .from(protochatSettings)
      .where(eq(protochatSettings.id, 'pricing_multiplier'))
      .limit(1);

    if (!setting.length) {
      return 1; // Default multiplier
    }

    return Number(setting[0].value);
  }

  /**
   * Calculate usage cost
   * @param modelId ProtoChat model ID
   * @param inputTokens Number of input tokens
   * @param outputTokens Number of output tokens
   * @returns Total cost (in credits), returns 0 for free models
   */
  async calculateCost(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
  ): Promise<{ cost: number; isFree: boolean }> {
    const pricing = await this.getModelPricing(modelId);

    if (!pricing) {
      console.error(`[ProtoChat] Pricing not found for model: ${modelId}`);
      return { cost: 0, isFree: false };
    }

    if (pricing.isFree) {
      return { cost: 0, isFree: true };
    }

    // Calculate cost: (tokens / 1,000,000) * price_per_million
    const inputCost = (inputTokens / 1_000_000) * pricing.userInputPrice;
    const outputCost = (outputTokens / 1_000_000) * pricing.userOutputPrice;
    const totalCost = Math.ceil(inputCost + outputCost);

    return { cost: totalCost, isFree: false };
  }

  /**
   * Log usage
   */
  async logUsage(params: {
    costPrice?: number;
    inputTokens: number;
    modelId: string;
    originalProvider: string;
    outputTokens: number;
    requestId?: string;
    userId: string;
    userPrice?: number;
  }): Promise<void> {
    await this.db.insert(protochatUsageLogs).values({
      costPrice: params.costPrice?.toString(),
      inputTokens: params.inputTokens,
      modelId: params.modelId,
      originalProvider: params.originalProvider,
      outputTokens: params.outputTokens,
      requestId: params.requestId,
      totalTokens: params.inputTokens + params.outputTokens,
      userId: params.userId,
      userPrice: params.userPrice?.toString(),
    });
  }

  /**
   * Get all enabled ProtoChat models list
   * Used by main project to retrieve model list
   */
  async getEnabledModels(): Promise<
    Array<{
      capabilities: Record<string, boolean> | null;
      contextTokens: number | null;
      displayName: string;
      id: string;
      maxOutput: number | null;
      type: string;
    }>
  > {
    const models = await this.db
      .select({
        capabilities: protochatModels.capabilities,
        contextTokens: protochatModels.contextTokens,
        displayName: protochatModels.displayName,
        id: protochatModels.id,
        maxOutput: protochatModels.maxOutput,
        type: protochatModels.type,
      })
      .from(protochatModels)
      .where(eq(protochatModels.enabled, true))
      .orderBy(protochatModels.displayName);

    return models.map((m) => ({
      ...m,
      capabilities: m.capabilities as Record<string, boolean> | null,
    }));
  }

  /**
   * Get all enabled underlying providers
   */
  async getEnabledProviders(): Promise<
    Array<{
      id: string;
      name: string;
      priority: number | null;
      type: string;
    }>
  > {
    const providers = await this.db
      .select({
        id: protochatProviders.id,
        name: protochatProviders.name,
        priority: protochatProviders.priority,
        type: protochatProviders.type,
      })
      .from(protochatProviders)
      .where(eq(protochatProviders.enabled, true))
      .orderBy(protochatProviders.priority);

    return providers;
  }

  /**
   * Check if provider is ProtoChat
   */
  static isProtoChatProvider(providerId: string): boolean {
    return providerId === 'protochat' || providerId === 'ProtoChat';
  }
}
