// @vitest-environment node
import { LobeChatDatabase } from '@lobechat/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';

import { ProtoChatService } from './index';

// Mock KeyVaultsGateKeeper
vi.mock('@/server/modules/KeyVaultsEncrypt', () => ({
  KeyVaultsGateKeeper: {
    initWithEnvKey: vi.fn(),
  },
}));

describe('ProtoChatService', () => {
  let service: ProtoChatService;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock database with query builder pattern
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
    };

    service = new ProtoChatService(mockDb as unknown as LobeChatDatabase);
  });

  describe('convertModelId', () => {
    it('should extract the last part of a double-colon separated ID', () => {
      const result = service.convertModelId('openrouter::openai/gpt-4o');
      expect(result).toBe('openai/gpt-4o');
    });

    it('should handle IDs with multiple colons', () => {
      const result = service.convertModelId('protochat::a1::gemini-2.5-flash');
      expect(result).toBe('gemini-2.5-flash');
    });

    it('should return the original ID if no colons present', () => {
      const result = service.convertModelId('gpt-4o');
      expect(result).toBe('gpt-4o');
    });

    it('should handle empty strings', () => {
      const result = service.convertModelId('');
      expect(result).toBe('');
    });
  });

  describe('getModelMapping', () => {
    it('should return model mapping with exact match', async () => {
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
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: 'encrypted-key',
      };

      const mockGateKeeper = {
        decrypt: vi.fn().mockResolvedValue({
          wasAuthentic: true,
          plaintext: JSON.stringify({
            apiKey: 'test-api-key',
            baseURL: 'https://custom.url',
          }),
        }),
      };

      mockDb.limit.mockResolvedValueOnce([mockModel]).mockResolvedValueOnce([mockProvider]);
      vi.mocked(KeyVaultsGateKeeper.initWithEnvKey).mockResolvedValue(
        mockGateKeeper as any,
      );

      const result = await service.getModelMapping('protochat::a1::gpt-4o');

      expect(result).toEqual({
        apiKey: 'test-api-key',
        baseUrl: 'https://custom.url',
        originalId: 'openrouter::openai/gpt-4o',
        originalProvider: 'openrouter',
        type: 'chat',
      });
    });

    it('should fallback to fuzzy match when exact match fails', async () => {
      const mockModel = {
        id: 'protochat::a1::gemini-2.5-flash',
        enabled: true,
        originalProvider: 'google',
        originalId: 'google::gemini-2.5-flash',
        type: 'chat',
      };

      const mockProvider = {
        id: 'google',
        enabled: true,
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: 'encrypted-key',
      };

      const mockGateKeeper = {
        decrypt: vi.fn().mockResolvedValue({
          wasAuthentic: true,
          plaintext: JSON.stringify({ apiKey: 'google-api-key' }),
        }),
      };

      // First call (exact match) returns empty, second call (fuzzy match) returns model
      mockDb.limit
        .mockResolvedValueOnce([]) // Exact match fails
        .mockResolvedValueOnce([mockModel]) // Fuzzy match succeeds
        .mockResolvedValueOnce([mockProvider]);

      vi.mocked(KeyVaultsGateKeeper.initWithEnvKey).mockResolvedValue(
        mockGateKeeper as any,
      );

      const result = await service.getModelMapping('gemini-2.5-flash');

      expect(result).toEqual({
        apiKey: 'google-api-key',
        baseUrl: 'https://generativelanguage.googleapis.com',
        originalId: 'google::gemini-2.5-flash',
        originalProvider: 'google',
        type: 'chat',
      });
    });

    it('should throw error when model not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      await expect(service.getModelMapping('non-existent')).rejects.toThrow(
        'ProtoChat model not found: non-existent',
      );
    });

    it('should throw error when model is disabled', async () => {
      const mockModel = {
        id: 'protochat::a1::gpt-4o',
        enabled: false,
        originalProvider: 'openrouter',
        originalId: 'openrouter::openai/gpt-4o',
        type: 'chat',
      };

      mockDb.limit.mockResolvedValueOnce([mockModel]);

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'ProtoChat model is disabled: protochat::a1::gpt-4o',
      );
    });

    it('should throw error when provider not found', async () => {
      const mockModel = {
        id: 'protochat::a1::gpt-4o',
        enabled: true,
        originalProvider: 'non-existent-provider',
        originalId: 'openrouter::openai/gpt-4o',
        type: 'chat',
      };

      mockDb.limit.mockResolvedValueOnce([mockModel]).mockResolvedValueOnce([]);

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'ProtoChat provider not found: non-existent-provider',
      );
    });

    it('should throw error when provider is disabled', async () => {
      const mockModel = {
        id: 'protochat::a1::gpt-4o',
        enabled: true,
        originalProvider: 'openrouter',
        originalId: 'openrouter::openai/gpt-4o',
        type: 'chat',
      };

      const mockProvider = {
        id: 'openrouter',
        enabled: false,
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: null,
      };

      mockDb.limit.mockResolvedValueOnce([mockModel]).mockResolvedValueOnce([mockProvider]);

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'ProtoChat provider is disabled: openrouter',
      );
    });

    it('should throw error when no API key found', async () => {
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
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: null,
      };

      mockDb.limit.mockResolvedValueOnce([mockModel]).mockResolvedValueOnce([mockProvider]);

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'No API key found for provider openrouter',
      );
    });

    it('should use proxyUrl from keyVaults if available', async () => {
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
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: 'encrypted-key',
      };

      const mockGateKeeper = {
        decrypt: vi.fn().mockResolvedValue({
          wasAuthentic: true,
          plaintext: JSON.stringify({
            apiKey: 'test-api-key',
            proxyUrl: 'https://proxy.url',
          }),
        }),
      };

      mockDb.limit.mockResolvedValueOnce([mockModel]).mockResolvedValueOnce([mockProvider]);
      vi.mocked(KeyVaultsGateKeeper.initWithEnvKey).mockResolvedValue(
        mockGateKeeper as any,
      );

      const result = await service.getModelMapping('protochat::a1::gpt-4o');

      expect(result.baseUrl).toBe('https://proxy.url');
    });

    it('should use baseUrl from keyVaults (lowercase) if no baseURL or proxyUrl', async () => {
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
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: 'encrypted-key',
      };

      const mockGateKeeper = {
        decrypt: vi.fn().mockResolvedValue({
          wasAuthentic: true,
          plaintext: JSON.stringify({
            apiKey: 'test-api-key',
            baseUrl: 'https://custom-base.url',
          }),
        }),
      };

      mockDb.limit.mockResolvedValueOnce([mockModel]).mockResolvedValueOnce([mockProvider]);
      vi.mocked(KeyVaultsGateKeeper.initWithEnvKey).mockResolvedValue(
        mockGateKeeper as any,
      );

      const result = await service.getModelMapping('protochat::a1::gpt-4o');

      expect(result.baseUrl).toBe('https://custom-base.url');
    });

    it('should handle decryption failure gracefully', async () => {
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
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: 'encrypted-key',
      };

      const mockGateKeeper = {
        decrypt: vi.fn().mockResolvedValue({
          wasAuthentic: false,
          plaintext: null,
        }),
      };

      mockDb.limit.mockResolvedValueOnce([mockModel]).mockResolvedValueOnce([mockProvider]);
      vi.mocked(KeyVaultsGateKeeper.initWithEnvKey).mockResolvedValue(
        mockGateKeeper as any,
      );

      await expect(service.getModelMapping('protochat::a1::gpt-4o')).rejects.toThrow(
        'No API key found for provider openrouter',
      );
    });
  });

  describe('getModelPricing', () => {
    it('should return pricing data when found', async () => {
      const mockPricing = {
        model: 'protochat::a1::gpt-4o',
        provider: 'protochat',
        userInputPrice: '100',
        userOutputPrice: '200',
      };

      mockDb.limit.mockResolvedValue([mockPricing]);

      const result = await service.getModelPricing('protochat::a1::gpt-4o');

      expect(result).toEqual({
        isFree: false,
        userInputPrice: 100,
        userOutputPrice: 200,
      });
    });

    it('should return null when pricing not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await service.getModelPricing('non-existent');

      expect(result).toBeNull();
    });

    it('should identify free models', async () => {
      const mockPricing = {
        model: 'protochat::a1::free-model',
        provider: 'protochat',
        userInputPrice: '0',
        userOutputPrice: '0',
      };

      mockDb.limit.mockResolvedValue([mockPricing]);

      const result = await service.getModelPricing('protochat::a1::free-model');

      expect(result).toEqual({
        isFree: true,
        userInputPrice: 0,
        userOutputPrice: 0,
      });
    });

    it('should convert string prices to numbers', async () => {
      const mockPricing = {
        model: 'protochat::a1::gpt-4o',
        provider: 'protochat',
        userInputPrice: '123.45',
        userOutputPrice: '678.90',
      };

      mockDb.limit.mockResolvedValue([mockPricing]);

      const result = await service.getModelPricing('protochat::a1::gpt-4o');

      expect(result?.userInputPrice).toBe(123.45);
      expect(result?.userOutputPrice).toBe(678.9);
    });
  });

  describe('getPricingMultiplier', () => {
    it('should return pricing multiplier from settings', async () => {
      const mockSetting = {
        id: 'pricing_multiplier',
        value: '1.5',
      };

      mockDb.limit.mockResolvedValue([mockSetting]);

      const result = await service.getPricingMultiplier();

      expect(result).toBe(1.5);
    });

    it('should return default multiplier of 1 when setting not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await service.getPricingMultiplier();

      expect(result).toBe(1);
    });

    it('should convert string value to number', async () => {
      const mockSetting = {
        id: 'pricing_multiplier',
        value: '2.25',
      };

      mockDb.limit.mockResolvedValue([mockSetting]);

      const result = await service.getPricingMultiplier();

      expect(result).toBe(2.25);
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost correctly for paid models', async () => {
      const mockPricing = {
        model: 'protochat::a1::gpt-4o',
        provider: 'protochat',
        userInputPrice: '100', // 100 credits per million input tokens
        userOutputPrice: '200', // 200 credits per million output tokens
      };

      mockDb.limit.mockResolvedValue([mockPricing]);

      const result = await service.calculateCost('protochat::a1::gpt-4o', 1_000_000, 500_000);

      // Input: (1_000_000 / 1_000_000) * 100 = 100
      // Output: (500_000 / 1_000_000) * 200 = 100
      // Total: Math.ceil(100 + 100) = 200
      expect(result).toEqual({
        cost: 200,
        isFree: false,
      });
    });

    it('should return zero cost for free models', async () => {
      const mockPricing = {
        model: 'protochat::a1::free-model',
        provider: 'protochat',
        userInputPrice: '0',
        userOutputPrice: '0',
      };

      mockDb.limit.mockResolvedValue([mockPricing]);

      const result = await service.calculateCost('protochat::a1::free-model', 1_000_000, 1_000_000);

      expect(result).toEqual({
        cost: 0,
        isFree: true,
      });
    });

    it('should return zero cost when pricing not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await service.calculateCost('non-existent', 1_000_000, 1_000_000);

      expect(result).toEqual({
        cost: 0,
        isFree: false,
      });
    });

    it('should ceil the total cost', async () => {
      const mockPricing = {
        model: 'protochat::a1::gpt-4o',
        provider: 'protochat',
        userInputPrice: '100',
        userOutputPrice: '100',
      };

      mockDb.limit.mockResolvedValue([mockPricing]);

      // Small token amounts that result in fractional costs
      const result = await service.calculateCost('protochat::a1::gpt-4o', 15_000, 15_000);

      // Input: (15_000 / 1_000_000) * 100 = 1.5
      // Output: (15_000 / 1_000_000) * 100 = 1.5
      // Total: Math.ceil(1.5 + 1.5) = Math.ceil(3) = 3
      expect(result).toEqual({
        cost: 3,
        isFree: false,
      });
    });

    it('should handle zero tokens', async () => {
      const mockPricing = {
        model: 'protochat::a1::gpt-4o',
        provider: 'protochat',
        userInputPrice: '100',
        userOutputPrice: '200',
      };

      mockDb.limit.mockResolvedValue([mockPricing]);

      const result = await service.calculateCost('protochat::a1::gpt-4o', 0, 0);

      expect(result).toEqual({
        cost: 0,
        isFree: false,
      });
    });
  });

  describe('logUsage', () => {
    it('should insert usage log with all parameters', async () => {
      await service.logUsage({
        userId: 'user-123',
        modelId: 'protochat::a1::gpt-4o',
        originalProvider: 'openrouter',
        inputTokens: 1000,
        outputTokens: 500,
        costPrice: 50,
        userPrice: 100,
        requestId: 'req-123',
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        userId: 'user-123',
        modelId: 'protochat::a1::gpt-4o',
        originalProvider: 'openrouter',
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        costPrice: '50',
        userPrice: '100',
        requestId: 'req-123',
      });
    });

    it('should handle optional parameters being undefined', async () => {
      await service.logUsage({
        userId: 'user-123',
        modelId: 'protochat::a1::gpt-4o',
        originalProvider: 'openrouter',
        inputTokens: 1000,
        outputTokens: 500,
      });

      expect(mockDb.values).toHaveBeenCalledWith({
        userId: 'user-123',
        modelId: 'protochat::a1::gpt-4o',
        originalProvider: 'openrouter',
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        costPrice: undefined,
        userPrice: undefined,
        requestId: undefined,
      });
    });

    it('should calculate totalTokens correctly', async () => {
      await service.logUsage({
        userId: 'user-123',
        modelId: 'protochat::a1::gpt-4o',
        originalProvider: 'openrouter',
        inputTokens: 2500,
        outputTokens: 1500,
      });

      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          totalTokens: 4000,
        }),
      );
    });
  });

  describe('getEnabledModels', () => {
    it('should return list of enabled models', async () => {
      const mockModels = [
        {
          id: 'protochat::a1::gpt-4o',
          displayName: 'GPT-4o',
          type: 'chat',
          contextTokens: 128000,
          maxOutput: 16384,
          capabilities: { vision: true, functionCalling: true },
        },
        {
          id: 'protochat::a1::gemini-2.5-flash',
          displayName: 'Gemini 2.5 Flash',
          type: 'chat',
          contextTokens: 1000000,
          maxOutput: 8192,
          capabilities: { vision: true },
        },
      ];

      mockDb.orderBy.mockResolvedValue(mockModels);

      const result = await service.getEnabledModels();

      expect(result).toEqual(mockModels);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no enabled models', async () => {
      mockDb.orderBy.mockResolvedValue([]);

      const result = await service.getEnabledModels();

      expect(result).toEqual([]);
    });

    it('should properly type capabilities', async () => {
      const mockModels = [
        {
          id: 'protochat::a1::gpt-4o',
          displayName: 'GPT-4o',
          type: 'chat',
          contextTokens: 128000,
          maxOutput: 16384,
          capabilities: null,
        },
      ];

      mockDb.orderBy.mockResolvedValue(mockModels);

      const result = await service.getEnabledModels();

      expect(result[0].capabilities).toBeNull();
    });
  });

  describe('getEnabledProviders', () => {
    it('should return list of enabled providers ordered by priority', async () => {
      const mockProviders = [
        {
          id: 'openrouter',
          name: 'OpenRouter',
          type: 'openai',
          priority: 1,
        },
        {
          id: 'google',
          name: 'Google AI',
          type: 'google',
          priority: 2,
        },
      ];

      mockDb.orderBy.mockResolvedValue(mockProviders);

      const result = await service.getEnabledProviders();

      expect(result).toEqual(mockProviders);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no enabled providers', async () => {
      mockDb.orderBy.mockResolvedValue([]);

      const result = await service.getEnabledProviders();

      expect(result).toEqual([]);
    });
  });

  describe('isProtoChatProvider', () => {
    it('should return true for "protochat" (lowercase)', () => {
      const result = ProtoChatService.isProtoChatProvider('protochat');
      expect(result).toBe(true);
    });

    it('should return true for "ProtoChat" (capitalized)', () => {
      const result = ProtoChatService.isProtoChatProvider('ProtoChat');
      expect(result).toBe(true);
    });

    it('should return false for other provider IDs', () => {
      expect(ProtoChatService.isProtoChatProvider('openai')).toBe(false);
      expect(ProtoChatService.isProtoChatProvider('anthropic')).toBe(false);
      expect(ProtoChatService.isProtoChatProvider('google')).toBe(false);
    });

    it('should return false for empty string', () => {
      const result = ProtoChatService.isProtoChatProvider('');
      expect(result).toBe(false);
    });

    it('should be case-sensitive for variations other than ProtoChat', () => {
      expect(ProtoChatService.isProtoChatProvider('PROTOCHAT')).toBe(false);
      expect(ProtoChatService.isProtoChatProvider('protoChat')).toBe(false);
    });
  });
});
