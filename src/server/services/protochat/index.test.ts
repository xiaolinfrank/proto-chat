// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';

import { ProtoChatService } from './index';

vi.mock('@/server/modules/KeyVaultsEncrypt', () => ({
  KeyVaultsGateKeeper: {
    initWithEnvKey: vi.fn(),
  },
}));

// Helper to create a chainable DB query mock
const createSelectChain = (result: any[]) => ({
  from: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockResolvedValue(result),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue(result),
});

const createInsertChain = () => ({
  values: vi.fn().mockResolvedValue(undefined),
});

describe('ProtoChatService', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn().mockReturnValue(createInsertChain()),
      select: vi.fn(),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── Static / pure methods ───────────────────────────────────────────────────

  describe('isProtoChatProvider (static)', () => {
    it('should return true for "protochat"', () => {
      expect(ProtoChatService.isProtoChatProvider('protochat')).toBe(true);
    });

    it('should return true for "ProtoChat"', () => {
      expect(ProtoChatService.isProtoChatProvider('ProtoChat')).toBe(true);
    });

    it('should return false for other provider IDs', () => {
      expect(ProtoChatService.isProtoChatProvider('openai')).toBe(false);
      expect(ProtoChatService.isProtoChatProvider('anthropic')).toBe(false);
      expect(ProtoChatService.isProtoChatProvider('')).toBe(false);
    });
  });

  describe('convertModelId', () => {
    it('should extract last segment from "provider::model" format', () => {
      const service = new ProtoChatService(mockDb);
      expect(service.convertModelId('openrouter::openai/gpt-4o')).toBe('openai/gpt-4o');
    });

    it('should return original ID when no "::" separator', () => {
      const service = new ProtoChatService(mockDb);
      expect(service.convertModelId('gpt-4o')).toBe('gpt-4o');
    });

    it('should return last segment when there are multiple "::" separators', () => {
      const service = new ProtoChatService(mockDb);
      expect(service.convertModelId('protochat::a1::gpt-4o')).toBe('gpt-4o');
    });

    it('should handle empty string', () => {
      const service = new ProtoChatService(mockDb);
      // split('::') on '' gives [''], at(-1) gives ''
      expect(service.convertModelId('')).toBe('');
    });
  });

  // ─── getModelPricing ─────────────────────────────────────────────────────────

  describe('getModelPricing', () => {
    it('should return pricing data when found', async () => {
      const service = new ProtoChatService(mockDb);
      mockDb.select.mockReturnValue(
        createSelectChain([
          {
            model: 'protochat::gpt-4o',
            provider: 'protochat',
            userInputPrice: '10.5',
            userOutputPrice: '20.5',
          },
        ]),
      );

      const result = await service.getModelPricing('protochat::gpt-4o');

      expect(result).toEqual({
        isFree: false,
        userInputPrice: 10.5,
        userOutputPrice: 20.5,
      });
    });

    it('should return null when pricing is not found', async () => {
      const service = new ProtoChatService(mockDb);
      mockDb.select.mockReturnValue(createSelectChain([]));

      const result = await service.getModelPricing('unknown-model');

      expect(result).toBeNull();
    });

    it('should mark model as free when both prices are 0', async () => {
      const service = new ProtoChatService(mockDb);
      mockDb.select.mockReturnValue(
        createSelectChain([
          { model: 'protochat::free-model', provider: 'protochat', userInputPrice: '0', userOutputPrice: '0' },
        ]),
      );

      const result = await service.getModelPricing('protochat::free-model');

      expect(result?.isFree).toBe(true);
      expect(result?.userInputPrice).toBe(0);
      expect(result?.userOutputPrice).toBe(0);
    });

    it('should not mark model as free when only input price is 0', async () => {
      const service = new ProtoChatService(mockDb);
      mockDb.select.mockReturnValue(
        createSelectChain([
          { model: 'model', provider: 'protochat', userInputPrice: '0', userOutputPrice: '5' },
        ]),
      );

      const result = await service.getModelPricing('model');

      expect(result?.isFree).toBe(false);
    });
  });

  // ─── getPricingMultiplier ─────────────────────────────────────────────────────

  describe('getPricingMultiplier', () => {
    it('should return multiplier from settings', async () => {
      const service = new ProtoChatService(mockDb);
      mockDb.select.mockReturnValue(
        createSelectChain([{ id: 'pricing_multiplier', value: '1.5' }]),
      );

      const result = await service.getPricingMultiplier();

      expect(result).toBe(1.5);
    });

    it('should return default multiplier of 1 when setting is not found', async () => {
      const service = new ProtoChatService(mockDb);
      mockDb.select.mockReturnValue(createSelectChain([]));

      const result = await service.getPricingMultiplier();

      expect(result).toBe(1);
    });
  });

  // ─── calculateCost ────────────────────────────────────────────────────────────

  describe('calculateCost', () => {
    it('should calculate cost for paid model', async () => {
      const service = new ProtoChatService(mockDb);
      vi.spyOn(service, 'getModelPricing').mockResolvedValue({
        isFree: false,
        userInputPrice: 10, // 10 credits per million tokens
        userOutputPrice: 30,
      });

      // (500_000 / 1_000_000) * 10 + (200_000 / 1_000_000) * 30 = 5 + 6 = ceil(11) = 11
      const result = await service.calculateCost('model', 500_000, 200_000);

      expect(result).toEqual({ cost: 11, isFree: false });
    });

    it('should return 0 cost for free model', async () => {
      const service = new ProtoChatService(mockDb);
      vi.spyOn(service, 'getModelPricing').mockResolvedValue({
        isFree: true,
        userInputPrice: 0,
        userOutputPrice: 0,
      });

      const result = await service.calculateCost('free-model', 100_000, 50_000);

      expect(result).toEqual({ cost: 0, isFree: true });
    });

    it('should return 0 cost when pricing is not found', async () => {
      const service = new ProtoChatService(mockDb);
      vi.spyOn(service, 'getModelPricing').mockResolvedValue(null);

      const result = await service.calculateCost('unknown-model', 100_000, 50_000);

      expect(result).toEqual({ cost: 0, isFree: false });
    });

    it('should ceil the total cost (fractional credits round up)', async () => {
      const service = new ProtoChatService(mockDb);
      vi.spyOn(service, 'getModelPricing').mockResolvedValue({
        isFree: false,
        userInputPrice: 3,
        userOutputPrice: 3,
      });

      // (1_000 / 1_000_000) * 3 + (1_000 / 1_000_000) * 3 = 0.003 + 0.003 = 0.006 → ceil = 1
      const result = await service.calculateCost('model', 1_000, 1_000);

      expect(result.cost).toBe(1);
    });

    it('should handle zero tokens', async () => {
      const service = new ProtoChatService(mockDb);
      vi.spyOn(service, 'getModelPricing').mockResolvedValue({
        isFree: false,
        userInputPrice: 10,
        userOutputPrice: 20,
      });

      const result = await service.calculateCost('model', 0, 0);

      expect(result).toEqual({ cost: 0, isFree: false });
    });
  });

  // ─── logUsage ─────────────────────────────────────────────────────────────────

  describe('logUsage', () => {
    it('should insert usage log with all provided fields', async () => {
      const service = new ProtoChatService(mockDb);
      const mockValues = vi.fn().mockResolvedValue(undefined);
      mockDb.insert.mockReturnValue({ values: mockValues });

      await service.logUsage({
        costPrice: 10,
        inputTokens: 100,
        modelId: 'protochat::gpt-4o',
        originalProvider: 'openai',
        outputTokens: 50,
        requestId: 'req-123',
        userId: 'user1',
        userPrice: 15,
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          costPrice: '10',
          inputTokens: 100,
          modelId: 'protochat::gpt-4o',
          originalProvider: 'openai',
          outputTokens: 50,
          requestId: 'req-123',
          totalTokens: 150,
          userId: 'user1',
          userPrice: '15',
        }),
      );
    });

    it('should compute totalTokens as sum of input and output', async () => {
      const service = new ProtoChatService(mockDb);
      const mockValues = vi.fn().mockResolvedValue(undefined);
      mockDb.insert.mockReturnValue({ values: mockValues });

      await service.logUsage({
        inputTokens: 300,
        modelId: 'model',
        originalProvider: 'provider',
        outputTokens: 700,
        userId: 'user1',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ totalTokens: 1000 }),
      );
    });

    it('should store undefined for optional fields when not provided', async () => {
      const service = new ProtoChatService(mockDb);
      const mockValues = vi.fn().mockResolvedValue(undefined);
      mockDb.insert.mockReturnValue({ values: mockValues });

      await service.logUsage({
        inputTokens: 10,
        modelId: 'model',
        originalProvider: 'provider',
        outputTokens: 20,
        userId: 'user1',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          costPrice: undefined,
          requestId: undefined,
          userPrice: undefined,
        }),
      );
    });
  });

  // ─── getEnabledModels ─────────────────────────────────────────────────────────

  describe('getEnabledModels', () => {
    it('should return list of enabled models', async () => {
      const service = new ProtoChatService(mockDb);
      const mockModels = [
        {
          capabilities: { vision: true },
          contextTokens: 128_000,
          displayName: 'GPT-4o',
          id: 'protochat::gpt-4o',
          maxOutput: 4096,
          type: 'chat',
        },
        {
          capabilities: null,
          contextTokens: 200_000,
          displayName: 'Claude 3',
          id: 'protochat::claude-3',
          maxOutput: 8192,
          type: 'chat',
        },
      ];
      mockDb.select.mockReturnValue(createSelectChain(mockModels));

      const result = await service.getEnabledModels();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('protochat::gpt-4o');
      expect(result[0].capabilities).toEqual({ vision: true });
      expect(result[1].capabilities).toBeNull();
    });

    it('should return empty array when no models are enabled', async () => {
      const service = new ProtoChatService(mockDb);
      mockDb.select.mockReturnValue(createSelectChain([]));

      const result = await service.getEnabledModels();

      expect(result).toEqual([]);
    });
  });

  // ─── getEnabledProviders ──────────────────────────────────────────────────────

  describe('getEnabledProviders', () => {
    it('should return list of enabled providers', async () => {
      const service = new ProtoChatService(mockDb);
      const mockProviders = [
        { id: 'openai', name: 'OpenAI', priority: 1, type: 'chat' },
        { id: 'anthropic', name: 'Anthropic', priority: 2, type: 'chat' },
      ];
      mockDb.select.mockReturnValue(createSelectChain(mockProviders));

      const result = await service.getEnabledProviders();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('openai');
      expect(result[1].id).toBe('anthropic');
    });

    it('should return empty array when no providers are enabled', async () => {
      const service = new ProtoChatService(mockDb);
      mockDb.select.mockReturnValue(createSelectChain([]));

      const result = await service.getEnabledProviders();

      expect(result).toEqual([]);
    });
  });

  // ─── getModelMapping ──────────────────────────────────────────────────────────

  describe('getModelMapping', () => {
    const mockModel = {
      enabled: true,
      id: 'protochat::a1::gpt-4o',
      originalId: 'openai::gpt-4o',
      originalProvider: 'openai',
      type: 'chat',
    };

    const mockProvider = {
      apiKey: 'encrypted-key',
      baseUrl: 'https://api.openai.com',
      enabled: true,
      id: 'openai',
    };

    const setupGateKeeper = (keyVaults: Record<string, string>) => {
      vi.mocked(KeyVaultsGateKeeper.initWithEnvKey).mockResolvedValue({
        decrypt: vi.fn().mockResolvedValue({
          plaintext: JSON.stringify(keyVaults),
          wasAuthentic: true,
        }),
      } as any);
    };

    it('should return model mapping for exact model ID match', async () => {
      const service = new ProtoChatService(mockDb);
      setupGateKeeper({ apiKey: 'sk-test-key', baseURL: 'https://api.openai.com' });

      mockDb.select
        .mockReturnValueOnce(createSelectChain([mockModel]))
        .mockReturnValueOnce(createSelectChain([mockProvider]));

      const result = await service.getModelMapping('protochat::a1::gpt-4o');

      expect(result.apiKey).toBe('sk-test-key');
      expect(result.baseUrl).toBe('https://api.openai.com');
      expect(result.originalId).toBe('openai::gpt-4o');
      expect(result.originalProvider).toBe('openai');
      expect(result.type).toBe('chat');
    });

    it('should perform fuzzy match for short IDs not starting with "protochat::"', async () => {
      const service = new ProtoChatService(mockDb);
      setupGateKeeper({ apiKey: 'sk-test-key' });

      // First select: exact match returns empty
      // Second select: fuzzy match returns model
      // Third select: provider
      mockDb.select
        .mockReturnValueOnce(createSelectChain([]))
        .mockReturnValueOnce(createSelectChain([mockModel]))
        .mockReturnValueOnce(createSelectChain([mockProvider]));

      const result = await service.getModelMapping('gpt-4o');

      expect(result.apiKey).toBe('sk-test-key');
      expect(result.originalId).toBe('openai::gpt-4o');
    });

    it('should not perform fuzzy match when model ID starts with "protochat::"', async () => {
      const service = new ProtoChatService(mockDb);
      // Only one select call (exact match), returns empty, no fuzzy fallback
      mockDb.select.mockReturnValue(createSelectChain([]));

      await expect(service.getModelMapping('protochat::unknown')).rejects.toThrow(
        'ProtoChat model not found: protochat::unknown',
      );
    });

    it('should throw when model is not found', async () => {
      const service = new ProtoChatService(mockDb);
      mockDb.select.mockReturnValue(createSelectChain([]));

      await expect(service.getModelMapping('unknown-model')).rejects.toThrow(
        'ProtoChat model not found: unknown-model',
      );
    });

    it('should throw when found model is disabled', async () => {
      const service = new ProtoChatService(mockDb);
      mockDb.select.mockReturnValue(createSelectChain([{ ...mockModel, enabled: false }]));

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'ProtoChat model is disabled: protochat::a1::gpt-4o',
      );
    });

    it('should throw when provider is not found', async () => {
      const service = new ProtoChatService(mockDb);
      mockDb.select
        .mockReturnValueOnce(createSelectChain([mockModel]))
        .mockReturnValueOnce(createSelectChain([]));

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'ProtoChat provider not found: openai',
      );
    });

    it('should throw when provider is disabled', async () => {
      const service = new ProtoChatService(mockDb);
      mockDb.select
        .mockReturnValueOnce(createSelectChain([mockModel]))
        .mockReturnValueOnce(createSelectChain([{ ...mockProvider, enabled: false }]));

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'ProtoChat provider is disabled: openai',
      );
    });

    it('should throw when no API key after decryption', async () => {
      const service = new ProtoChatService(mockDb);
      // Decrypt returns keyVaults without apiKey
      setupGateKeeper({ baseURL: 'https://api.openai.com' });

      mockDb.select
        .mockReturnValueOnce(createSelectChain([mockModel]))
        .mockReturnValueOnce(createSelectChain([mockProvider]));

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'No API key found for provider openai',
      );
    });

    it('should throw when provider has no apiKey in DB', async () => {
      const service = new ProtoChatService(mockDb);
      mockDb.select
        .mockReturnValueOnce(createSelectChain([mockModel]))
        .mockReturnValueOnce(createSelectChain([{ ...mockProvider, apiKey: null }]));

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'No API key found for provider openai',
      );
    });

    it('should use keyVaults.baseURL as baseUrl (highest priority)', async () => {
      const service = new ProtoChatService(mockDb);
      setupGateKeeper({ apiKey: 'sk-key', baseURL: 'https://keyvault.example.com' });

      mockDb.select
        .mockReturnValueOnce(createSelectChain([mockModel]))
        .mockReturnValueOnce(createSelectChain([mockProvider]));

      const result = await service.getModelMapping('protochat::a1::gpt-4o');

      expect(result.baseUrl).toBe('https://keyvault.example.com');
    });

    it('should use keyVaults.proxyUrl when no baseURL in keyVaults', async () => {
      const service = new ProtoChatService(mockDb);
      setupGateKeeper({ apiKey: 'sk-key', proxyUrl: 'https://proxy.example.com' });

      mockDb.select
        .mockReturnValueOnce(createSelectChain([mockModel]))
        .mockReturnValueOnce(createSelectChain([mockProvider]));

      const result = await service.getModelMapping('protochat::a1::gpt-4o');

      expect(result.baseUrl).toBe('https://proxy.example.com');
    });

    it('should fall back to keyVaults.baseUrl (lowercase) when other url fields absent', async () => {
      const service = new ProtoChatService(mockDb);
      setupGateKeeper({ apiKey: 'sk-key', baseUrl: 'https://keyvaultlower.example.com' });

      mockDb.select
        .mockReturnValueOnce(createSelectChain([mockModel]))
        .mockReturnValueOnce(createSelectChain([mockProvider]));

      const result = await service.getModelMapping('protochat::a1::gpt-4o');

      expect(result.baseUrl).toBe('https://keyvaultlower.example.com');
    });

    it('should fall back to provider baseUrl when no URL in keyVaults', async () => {
      const service = new ProtoChatService(mockDb);
      // Only apiKey in keyVaults, no url fields
      setupGateKeeper({ apiKey: 'sk-key' });

      mockDb.select
        .mockReturnValueOnce(createSelectChain([mockModel]))
        .mockReturnValueOnce(createSelectChain([mockProvider]));

      const result = await service.getModelMapping('protochat::a1::gpt-4o');

      expect(result.baseUrl).toBe('https://api.openai.com');
    });

    it('should continue gracefully when decryption fails with an exception', async () => {
      const service = new ProtoChatService(mockDb);
      vi.mocked(KeyVaultsGateKeeper.initWithEnvKey).mockRejectedValue(
        new Error('KEY_VAULTS_SECRET is not set'),
      );

      mockDb.select
        .mockReturnValueOnce(createSelectChain([mockModel]))
        .mockReturnValueOnce(createSelectChain([mockProvider]));

      // Decryption fails → apiKey empty → throws "No API key found"
      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'No API key found for provider openai',
      );
    });
  });
});
