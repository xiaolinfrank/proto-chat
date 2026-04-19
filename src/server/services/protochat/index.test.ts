// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProtoChatService } from './index';

vi.mock('@/server/modules/KeyVaultsEncrypt', () => ({
  KeyVaultsGateKeeper: {
    initWithEnvKey: vi.fn(),
  },
}));

vi.mock('@lobechat/database', () => ({
  modelPricings: { model: 'model', provider: 'provider', userInputPrice: 'userInputPrice', userOutputPrice: 'userOutputPrice' },
  protochatModels: { id: 'id', enabled: 'enabled', originalProvider: 'originalProvider', originalId: 'originalId', type: 'type', displayName: 'displayName', contextTokens: 'contextTokens', maxOutput: 'maxOutput', capabilities: 'capabilities' },
  protochatProviders: { id: 'id', enabled: 'enabled', apiKey: 'apiKey', baseUrl: 'baseUrl', name: 'name', priority: 'priority', type: 'type' },
  protochatSettings: { id: 'id', value: 'value' },
  protochatUsageLogs: {},
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args) => ({ _and: args })),
  eq: vi.fn((col, val) => ({ _eq: [col, val] })),
  like: vi.fn((col, val) => ({ _like: [col, val] })),
}));

import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';

const buildSelectChain = (result: any[]) => {
  const limitFn = vi.fn().mockResolvedValue(result);
  const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
  const fromFn = vi.fn().mockReturnValue({ where: whereFn, orderBy: vi.fn().mockResolvedValue(result) });
  const selectFn = vi.fn().mockReturnValue({ from: fromFn });
  return { selectFn, fromFn, whereFn, limitFn };
};

describe('ProtoChatService', () => {
  let service: ProtoChatService;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
    };
    service = new ProtoChatService(mockDb);
  });

  describe('convertModelId', () => {
    it('should extract the last part after "::" separator', () => {
      expect(service.convertModelId('openrouter::openai/gpt-4o')).toBe('openai/gpt-4o');
    });

    it('should handle multiple "::" separators', () => {
      expect(service.convertModelId('protochat::a1::gpt-4o')).toBe('gpt-4o');
    });

    it('should return the original string when no "::" separator exists', () => {
      expect(service.convertModelId('gpt-4o')).toBe('gpt-4o');
    });

    it('should return original string for empty string', () => {
      expect(service.convertModelId('')).toBe('');
    });
  });

  describe('isProtoChatProvider', () => {
    it('should return true for "protochat"', () => {
      expect(ProtoChatService.isProtoChatProvider('protochat')).toBe(true);
    });

    it('should return true for "ProtoChat"', () => {
      expect(ProtoChatService.isProtoChatProvider('ProtoChat')).toBe(true);
    });

    it('should return false for other providers', () => {
      expect(ProtoChatService.isProtoChatProvider('openai')).toBe(false);
      expect(ProtoChatService.isProtoChatProvider('anthropic')).toBe(false);
      expect(ProtoChatService.isProtoChatProvider('')).toBe(false);
    });
  });

  describe('getModelPricing', () => {
    it('should return null when pricing is not found', async () => {
      const { selectFn, fromFn, whereFn, limitFn } = buildSelectChain([]);
      mockDb.select = selectFn;
      fromFn.mockReturnValue({ where: whereFn });
      whereFn.mockReturnValue({ limit: limitFn });

      const result = await service.getModelPricing('unknown-model');
      expect(result).toBeNull();
    });

    it('should return pricing when found', async () => {
      const mockPricing = { model: 'gpt-4o', provider: 'protochat', userInputPrice: '10', userOutputPrice: '20' };
      const limitFn = vi.fn().mockResolvedValue([mockPricing]);
      const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
      const fromFn = vi.fn().mockReturnValue({ where: whereFn });
      mockDb.select = vi.fn().mockReturnValue({ from: fromFn });

      const result = await service.getModelPricing('gpt-4o');
      expect(result).toEqual({ isFree: false, userInputPrice: 10, userOutputPrice: 20 });
    });

    it('should mark pricing as free when both prices are 0', async () => {
      const mockPricing = { model: 'free-model', provider: 'protochat', userInputPrice: '0', userOutputPrice: '0' };
      const limitFn = vi.fn().mockResolvedValue([mockPricing]);
      const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
      const fromFn = vi.fn().mockReturnValue({ where: whereFn });
      mockDb.select = vi.fn().mockReturnValue({ from: fromFn });

      const result = await service.getModelPricing('free-model');
      expect(result).toEqual({ isFree: true, userInputPrice: 0, userOutputPrice: 0 });
    });
  });

  describe('getPricingMultiplier', () => {
    it('should return 1 as default when setting not found', async () => {
      const limitFn = vi.fn().mockResolvedValue([]);
      const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
      const fromFn = vi.fn().mockReturnValue({ where: whereFn });
      mockDb.select = vi.fn().mockReturnValue({ from: fromFn });

      const result = await service.getPricingMultiplier();
      expect(result).toBe(1);
    });

    it('should return the configured multiplier value', async () => {
      const limitFn = vi.fn().mockResolvedValue([{ id: 'pricing_multiplier', value: '1.5' }]);
      const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
      const fromFn = vi.fn().mockReturnValue({ where: whereFn });
      mockDb.select = vi.fn().mockReturnValue({ from: fromFn });

      const result = await service.getPricingMultiplier();
      expect(result).toBe(1.5);
    });
  });

  describe('calculateCost', () => {
    it('should return cost 0 and isFree false when pricing not found', async () => {
      vi.spyOn(service, 'getModelPricing').mockResolvedValue(null);
      const result = await service.calculateCost('unknown-model', 100, 50);
      expect(result).toEqual({ cost: 0, isFree: false });
    });

    it('should return cost 0 and isFree true for free models', async () => {
      vi.spyOn(service, 'getModelPricing').mockResolvedValue({ isFree: true, userInputPrice: 0, userOutputPrice: 0 });
      const result = await service.calculateCost('free-model', 1000, 500);
      expect(result).toEqual({ cost: 0, isFree: true });
    });

    it('should calculate cost correctly for paid models', async () => {
      vi.spyOn(service, 'getModelPricing').mockResolvedValue({
        isFree: false,
        userInputPrice: 10, // 10 credits per million tokens
        userOutputPrice: 30, // 30 credits per million tokens
      });
      // 100k input tokens + 50k output tokens
      // inputCost = (100000 / 1_000_000) * 10 = 1
      // outputCost = (50000 / 1_000_000) * 30 = 1.5
      // total = Math.ceil(2.5) = 3
      const result = await service.calculateCost('gpt-4o', 100_000, 50_000);
      expect(result).toEqual({ cost: 3, isFree: false });
    });

    it('should ceil fractional costs', async () => {
      vi.spyOn(service, 'getModelPricing').mockResolvedValue({
        isFree: false,
        userInputPrice: 1,
        userOutputPrice: 1,
      });
      // 1 token each → 1/1_000_000 + 1/1_000_000 = 0.000002 → ceil = 1
      const result = await service.calculateCost('model', 1, 1);
      expect(result).toEqual({ cost: 1, isFree: false });
    });
  });

  describe('logUsage', () => {
    it('should insert usage log with correct values', async () => {
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      mockDb.insert = vi.fn().mockReturnValue({ values: mockInsertValues });

      await service.logUsage({
        userId: 'user-1',
        modelId: 'gpt-4o',
        originalProvider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        costPrice: 0.05,
        userPrice: 0.1,
        requestId: 'req-123',
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(mockInsertValues).toHaveBeenCalledWith({
        costPrice: '0.05',
        inputTokens: 100,
        modelId: 'gpt-4o',
        originalProvider: 'openai',
        outputTokens: 50,
        requestId: 'req-123',
        totalTokens: 150,
        userId: 'user-1',
        userPrice: '0.1',
      });
    });

    it('should handle undefined optional params', async () => {
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      mockDb.insert = vi.fn().mockReturnValue({ values: mockInsertValues });

      await service.logUsage({
        userId: 'user-1',
        modelId: 'gpt-4o',
        originalProvider: 'openai',
        inputTokens: 200,
        outputTokens: 100,
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          costPrice: undefined,
          userPrice: undefined,
          requestId: undefined,
          totalTokens: 300,
        }),
      );
    });
  });

  describe('getEnabledModels', () => {
    it('should return list of enabled models', async () => {
      const mockModels = [
        { id: 'protochat::a1::gpt-4o', displayName: 'GPT-4o', type: 'chat', contextTokens: 128000, maxOutput: 4096, capabilities: { vision: true } },
        { id: 'protochat::a1::claude-3', displayName: 'Claude 3', type: 'chat', contextTokens: 200000, maxOutput: 8192, capabilities: null },
      ];
      const orderByFn = vi.fn().mockResolvedValue(mockModels);
      const whereFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
      const fromFn = vi.fn().mockReturnValue({ where: whereFn });
      mockDb.select = vi.fn().mockReturnValue({ from: fromFn });

      const result = await service.getEnabledModels();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('protochat::a1::gpt-4o');
      expect(result[0].capabilities).toEqual({ vision: true });
      expect(result[1].capabilities).toBeNull();
    });

    it('should return empty array when no enabled models', async () => {
      const orderByFn = vi.fn().mockResolvedValue([]);
      const whereFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
      const fromFn = vi.fn().mockReturnValue({ where: whereFn });
      mockDb.select = vi.fn().mockReturnValue({ from: fromFn });

      const result = await service.getEnabledModels();
      expect(result).toEqual([]);
    });
  });

  describe('getEnabledProviders', () => {
    it('should return list of enabled providers', async () => {
      const mockProviders = [
        { id: 'openrouter', name: 'OpenRouter', priority: 1, type: 'chat' },
        { id: 'openai', name: 'OpenAI', priority: 2, type: 'chat' },
      ];
      const orderByFn = vi.fn().mockResolvedValue(mockProviders);
      const whereFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
      const fromFn = vi.fn().mockReturnValue({ where: whereFn });
      mockDb.select = vi.fn().mockReturnValue({ from: fromFn });

      const result = await service.getEnabledProviders();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('openrouter');
    });

    it('should return empty array when no providers enabled', async () => {
      const orderByFn = vi.fn().mockResolvedValue([]);
      const whereFn = vi.fn().mockReturnValue({ orderBy: orderByFn });
      const fromFn = vi.fn().mockReturnValue({ where: whereFn });
      mockDb.select = vi.fn().mockReturnValue({ from: fromFn });

      const result = await service.getEnabledProviders();
      expect(result).toEqual([]);
    });
  });

  describe('getModelMapping', () => {
    const mockModel = {
      id: 'protochat::a1::gpt-4o',
      enabled: true,
      originalProvider: 'openrouter',
      originalId: 'openrouter::openai/gpt-4o',
      type: 'chat',
    };
    const mockProvider = {
      id: 'openrouter',
      enabled: true,
      apiKey: 'encrypted-key',
      baseUrl: 'https://openrouter.ai/api/v1',
    };

    const setupModelDbMock = (modelResult: any[], providerResult: any[]) => {
      let callCount = 0;
      mockDb.select = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: exact model lookup
          const limitFn = vi.fn().mockResolvedValue(modelResult);
          const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
          return { from: vi.fn().mockReturnValue({ where: whereFn }) };
        } else {
          // Second call: provider lookup
          const limitFn = vi.fn().mockResolvedValue(providerResult);
          const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
          return { from: vi.fn().mockReturnValue({ where: whereFn }) };
        }
      });
    };

    it('should throw when model is not found', async () => {
      // Both exact and fuzzy lookups return empty
      let callCount = 0;
      mockDb.select = vi.fn().mockImplementation(() => {
        callCount++;
        const limitFn = vi.fn().mockResolvedValue([]);
        const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
        return { from: vi.fn().mockReturnValue({ where: whereFn }) };
      });

      await expect(service.getModelMapping('nonexistent-model')).rejects.toThrow(
        'ProtoChat model not found: nonexistent-model',
      );
    });

    it('should throw when model is disabled', async () => {
      const disabledModel = { ...mockModel, enabled: false };
      setupModelDbMock([disabledModel], []);

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'ProtoChat model is disabled: protochat::a1::gpt-4o',
      );
    });

    it('should throw when provider is not found', async () => {
      setupModelDbMock([mockModel], []);

      (KeyVaultsGateKeeper.initWithEnvKey as any).mockResolvedValue({
        decrypt: vi.fn().mockResolvedValue({ wasAuthentic: true, plaintext: JSON.stringify({ apiKey: 'sk-test' }) }),
      });

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'ProtoChat provider not found: openrouter',
      );
    });

    it('should throw when provider is disabled', async () => {
      const disabledProvider = { ...mockProvider, enabled: false };
      setupModelDbMock([mockModel], [disabledProvider]);

      (KeyVaultsGateKeeper.initWithEnvKey as any).mockResolvedValue({
        decrypt: vi.fn().mockResolvedValue({ wasAuthentic: true, plaintext: JSON.stringify({ apiKey: 'sk-test' }) }),
      });

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'ProtoChat provider is disabled: openrouter',
      );
    });

    it('should throw when no API key found after decryption', async () => {
      setupModelDbMock([mockModel], [mockProvider]);

      (KeyVaultsGateKeeper.initWithEnvKey as any).mockResolvedValue({
        decrypt: vi.fn().mockResolvedValue({ wasAuthentic: true, plaintext: JSON.stringify({}) }),
      });

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'No API key found for provider openrouter',
      );
    });

    it('should return mapping with decrypted API key', async () => {
      setupModelDbMock([mockModel], [mockProvider]);

      (KeyVaultsGateKeeper.initWithEnvKey as any).mockResolvedValue({
        decrypt: vi.fn().mockResolvedValue({
          wasAuthentic: true,
          plaintext: JSON.stringify({ apiKey: 'sk-decrypted-key' }),
        }),
      });

      const result = await service.getModelMapping('protochat::a1::gpt-4o');
      expect(result).toEqual({
        apiKey: 'sk-decrypted-key',
        baseUrl: 'https://openrouter.ai/api/v1',
        originalId: 'openrouter::openai/gpt-4o',
        originalProvider: 'openrouter',
        type: 'chat',
      });
    });

    it('should prefer keyVaults.baseURL over provider baseUrl', async () => {
      setupModelDbMock([mockModel], [mockProvider]);

      (KeyVaultsGateKeeper.initWithEnvKey as any).mockResolvedValue({
        decrypt: vi.fn().mockResolvedValue({
          wasAuthentic: true,
          plaintext: JSON.stringify({ apiKey: 'sk-test', baseURL: 'https://custom.url/v1' }),
        }),
      });

      const result = await service.getModelMapping('protochat::a1::gpt-4o');
      expect(result.baseUrl).toBe('https://custom.url/v1');
    });

    it('should use keyVaults.proxyUrl when baseURL is not present', async () => {
      setupModelDbMock([mockModel], [mockProvider]);

      (KeyVaultsGateKeeper.initWithEnvKey as any).mockResolvedValue({
        decrypt: vi.fn().mockResolvedValue({
          wasAuthentic: true,
          plaintext: JSON.stringify({ apiKey: 'sk-test', proxyUrl: 'https://proxy.url/v1' }),
        }),
      });

      const result = await service.getModelMapping('protochat::a1::gpt-4o');
      expect(result.baseUrl).toBe('https://proxy.url/v1');
    });

    it('should skip decryption when provider has no apiKey', async () => {
      const providerNoKey = { ...mockProvider, apiKey: null };
      setupModelDbMock([mockModel], [providerNoKey]);

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'No API key found for provider openrouter',
      );
      expect(KeyVaultsGateKeeper.initWithEnvKey).not.toHaveBeenCalled();
    });

    it('should attempt fuzzy match for short model IDs without protochat:: prefix', async () => {
      let callCount = 0;
      const exactLimitFn = vi.fn().mockResolvedValue([]);
      const fuzzyLimitFn = vi.fn().mockResolvedValue([mockModel]);
      const providerLimitFn = vi.fn().mockResolvedValue([mockProvider]);

      mockDb.select = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const whereFn = vi.fn().mockReturnValue({ limit: exactLimitFn });
          return { from: vi.fn().mockReturnValue({ where: whereFn }) };
        } else if (callCount === 2) {
          const whereFn = vi.fn().mockReturnValue({ limit: fuzzyLimitFn });
          return { from: vi.fn().mockReturnValue({ where: whereFn }) };
        } else {
          const whereFn = vi.fn().mockReturnValue({ limit: providerLimitFn });
          return { from: vi.fn().mockReturnValue({ where: whereFn }) };
        }
      });

      (KeyVaultsGateKeeper.initWithEnvKey as any).mockResolvedValue({
        decrypt: vi.fn().mockResolvedValue({
          wasAuthentic: true,
          plaintext: JSON.stringify({ apiKey: 'sk-test' }),
        }),
      });

      const result = await service.getModelMapping('gpt-4o');
      expect(result.originalProvider).toBe('openrouter');
    });
  });
});
