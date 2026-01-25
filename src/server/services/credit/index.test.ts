import { LobeChatDatabase } from '@/database/type';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreditService } from './index';

// Mock console methods to avoid cluttering test output
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

const mockUserId = 'test-user-id';

// Mock database transaction function
const createMockDB = () => {
  const mockTransaction = vi.fn();
  const mockQuery = {
    modelPricings: {
      findFirst: vi.fn(),
    },
    userBalances: {
      findFirst: vi.fn(),
    },
  };

  const mockDB = {
    query: mockQuery,
    transaction: mockTransaction,
    update: vi.fn(),
    insert: vi.fn(),
  } as unknown as LobeChatDatabase;

  return { mockDB, mockQuery, mockTransaction };
};

describe('CreditService', () => {
  let service: CreditService;
  let mockDB: LobeChatDatabase;
  let mockQuery: ReturnType<typeof createMockDB>['mockQuery'];
  let mockTransaction: ReturnType<typeof createMockDB>['mockTransaction'];

  beforeEach(() => {
    const mocks = createMockDB();
    mockDB = mocks.mockDB;
    mockQuery = mocks.mockQuery;
    mockTransaction = mocks.mockTransaction;
    service = new CreditService(mockDB, mockUserId);
    vi.clearAllMocks();
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using their own API key', async () => {
      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);

      expect(cost).toBe(0);
      expect(mockQuery.modelPricings.findFirst).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        '[Credit] User using own config for openai, no charge',
      );
    });

    it('should return 0 when no pricing found for model', async () => {
      mockQuery.modelPricings.findFirst.mockResolvedValue(null);

      const cost = await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);

      expect(cost).toBe(0);
      expect(mockQuery.modelPricings.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        }),
      );
      expect(console.warn).toHaveBeenCalledWith(
        '[Credit] No pricing found for unknown-provider::unknown-model, no charge',
      );
    });

    it('should calculate cost correctly with fixed pricing', async () => {
      mockQuery.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '5.00',
        userOutputPrice: '15.00',
        perRequestPrice: '0',
        subProvider: null,
      });

      // 1M input tokens at $5/1M = $5, 1M output tokens at $15/1M = $15, total = $20
      const cost = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);

      expect(cost).toBe(20);
      expect(console.log).toHaveBeenCalledWith(
        '[Credit] Charging for openai::gpt-4, cost: 20.0000 credits',
      );
    });

    it('should calculate cost correctly with fractional tokens', async () => {
      mockQuery.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-3.5-turbo',
        provider: 'openai',
        userInputPrice: '0.50',
        userOutputPrice: '1.50',
        perRequestPrice: '0',
        subProvider: null,
      });

      // 100k input tokens at $0.50/1M = $0.05, 50k output tokens at $1.50/1M = $0.075, total = $0.125
      const cost = await service.calculateCost('gpt-3.5-turbo', 'openai', 100_000, 50_000);

      expect(cost).toBeCloseTo(0.125, 6);
    });

    it('should include per-request price in calculation', async () => {
      mockQuery.modelPricings.findFirst.mockResolvedValue({
        model: 'claude-3-opus',
        provider: 'anthropic',
        userInputPrice: '15.00',
        userOutputPrice: '75.00',
        perRequestPrice: '0.10',
        subProvider: null,
      });

      // 500k input at $15/1M = $7.5, 250k output at $75/1M = $18.75, per-request = $0.10, total = $26.35
      const cost = await service.calculateCost('claude-3-opus', 'anthropic', 500_000, 250_000);

      expect(cost).toBeCloseTo(26.35, 6);
    });

    it('should handle zero tokens', async () => {
      mockQuery.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '5.00',
        userOutputPrice: '15.00',
        perRequestPrice: '0',
        subProvider: null,
      });

      const cost = await service.calculateCost('gpt-4', 'openai', 0, 0);

      expect(cost).toBe(0);
    });

    it('should log sub-provider info when available', async () => {
      mockQuery.modelPricings.findFirst.mockResolvedValue({
        model: 'deepseek-chat',
        provider: 'protochat',
        userInputPrice: '0.27',
        userOutputPrice: '1.10',
        perRequestPrice: '0',
        subProvider: 'deepseek',
      });

      await service.calculateCost('deepseek-chat', 'protochat', 1_000_000, 1_000_000);

      expect(console.log).toHaveBeenCalledWith(
        '[Credit] Charging for protochat::deepseek-chat (via deepseek), cost: 1.3700 credits',
      );
    });

    it('should handle null or undefined pricing values', async () => {
      mockQuery.modelPricings.findFirst.mockResolvedValue({
        model: 'test-model',
        provider: 'test-provider',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
        subProvider: null,
      });

      const cost = await service.calculateCost('test-model', 'test-provider', 1_000_000, 1_000_000);

      expect(cost).toBe(0);
    });
  });

  describe('deductCredits', () => {
    it('should not deduct when amount is 0', async () => {
      await service.deductCredits(0, 'Test transaction');

      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should not deduct when amount is negative', async () => {
      await service.deductCredits(-5, 'Test transaction');

      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should throw error when user balance not found', async () => {
      mockTransaction.mockImplementation(async (callback) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(null),
            },
          },
        };
        return callback(mockTx);
      });

      await expect(service.deductCredits(10, 'Test transaction')).rejects.toThrow(
        'User balance not found',
      );
    });

    it('should throw error when insufficient credits (non-unlimited account)', async () => {
      mockTransaction.mockImplementation(async (callback) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId: mockUserId,
                balance: '5.0000',
                isUnlimited: false,
              }),
            },
          },
        };
        return callback(mockTx);
      });

      await expect(service.deductCredits(10, 'Test transaction')).rejects.toThrow(
        'Insufficient credits',
      );
    });

    it('should deduct credits successfully from non-unlimited account', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      mockTransaction.mockImplementation(async (callback) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId: mockUserId,
                balance: '100.0000',
                isUnlimited: false,
              }),
            },
          },
          update: mockUpdate,
          insert: mockInsert,
        };
        return callback(mockTx);
      });

      const result = await service.deductCredits(25.5, 'API usage', 'msg-123', {
        model: 'gpt-4',
      });

      expect(result).toBe(74.5);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should allow deduction from unlimited account regardless of balance', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      mockTransaction.mockImplementation(async (callback) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId: mockUserId,
                balance: '10.0000',
                isUnlimited: true,
              }),
            },
          },
          update: mockUpdate,
          insert: mockInsert,
        };
        return callback(mockTx);
      });

      const result = await service.deductCredits(50, 'API usage');

      expect(result).toBe(-40);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should create transaction record with correct values', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      mockTransaction.mockImplementation(async (callback) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId: mockUserId,
                balance: '100.0000',
                isUnlimited: false,
              }),
            },
          },
          update: mockUpdate,
          insert: mockInsert,
        };
        return callback(mockTx);
      });

      await service.deductCredits(15.5, 'Model usage', 'ref-123', { extra: 'data' });

      const insertCall = mockInsert.mock.calls[0];
      const valuesCall = insertCall ? mockInsert().values.mock.calls[0][0] : null;

      expect(valuesCall).toMatchObject({
        userId: mockUserId,
        amount: '-15.5000',
        balanceAfter: '84.5000',
        type: 'CONSUMPTION',
        category: 'CONSUMPTION',
        description: 'Model usage',
        refId: 'ref-123',
        metadata: { extra: 'data' },
      });
      expect(valuesCall.id).toMatch(/^tx_/);
    });

    it('should handle fractional amounts with proper precision', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      mockTransaction.mockImplementation(async (callback) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId: mockUserId,
                balance: '50.1234',
                isUnlimited: false,
              }),
            },
          },
          update: mockUpdate,
          insert: mockInsert,
        };
        return callback(mockTx);
      });

      const result = await service.deductCredits(10.5678, 'Test');

      expect(result).toBeCloseTo(39.5556, 4);
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when balance not found', async () => {
      mockQuery.userBalances.findFirst.mockResolvedValue(null);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true for unlimited accounts', async () => {
      mockQuery.userBalances.findFirst.mockResolvedValue({
        userId: mockUserId,
        balance: '0',
        isUnlimited: true,
      });

      const result = await service.hasEnoughCredits(1000);

      expect(result).toBe(true);
    });

    it('should return true when balance > 0 and no estimated amount', async () => {
      mockQuery.userBalances.findFirst.mockResolvedValue({
        userId: mockUserId,
        balance: '0.0001',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits();

      expect(result).toBe(true);
    });

    it('should return false when balance = 0 and no estimated amount', async () => {
      mockQuery.userBalances.findFirst.mockResolvedValue({
        userId: mockUserId,
        balance: '0',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when balance >= estimated amount', async () => {
      mockQuery.userBalances.findFirst.mockResolvedValue({
        userId: mockUserId,
        balance: '100.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should return false when balance < estimated amount', async () => {
      mockQuery.userBalances.findFirst.mockResolvedValue({
        userId: mockUserId,
        balance: '25.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(false);
    });

    it('should handle exact balance match', async () => {
      mockQuery.userBalances.findFirst.mockResolvedValue({
        userId: mockUserId,
        balance: '42.5000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(42.5);

      expect(result).toBe(true);
    });
  });
});
