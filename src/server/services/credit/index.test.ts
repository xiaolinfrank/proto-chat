import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';

import { CreditService } from './index';

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: LobeChatDatabase;
  const userId = 'test-user-id';

  // Helper function to setup query mock for findFirst
  const setupFindFirstMock = (mockData: any) => {
    mockDb.query = {
      modelPricings: {
        findFirst: vi.fn().mockResolvedValue(mockData),
      },
      userBalances: {
        findFirst: vi.fn().mockResolvedValue(mockData),
      },
    } as any;
  };

  // Helper function to setup transaction mock
  const setupTransactionMock = (mockBalance: any, txExecutor?: any) => {
    const mockTxQuery = {
      userBalances: {
        findFirst: vi.fn().mockResolvedValue(mockBalance),
      },
    };

    const mockTxUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const mockTxInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    const mockTx = {
      query: mockTxQuery,
      update: mockTxUpdate,
      insert: mockTxInsert,
    };

    if (txExecutor) {
      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      });
    } else {
      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      });
    }

    return mockTx;
  };

  beforeEach(() => {
    mockDb = {
      query: {},
      transaction: vi.fn(),
    } as unknown as LobeChatDatabase;

    service = new CreditService(mockDb, userId);
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using their own API key', async () => {
      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);

      expect(cost).toBe(0);
    });

    it('should return 0 when pricing is not found', async () => {
      setupFindFirstMock(null);

      const cost = await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);

      expect(cost).toBe(0);
    });

    it('should calculate cost correctly with input and output tokens', async () => {
      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0', // 10 credits per 1M tokens
        userOutputPrice: '20.0', // 20 credits per 1M tokens
        perRequestPrice: '0.0',
      };

      setupFindFirstMock(mockPricing);

      // 1,000,000 input tokens + 500,000 output tokens
      const cost = await service.calculateCost('gpt-4', 'openai', 1_000_000, 500_000);

      // Expected: (1_000_000 / 1_000_000) * 10 + (500_000 / 1_000_000) * 20 = 10 + 10 = 20
      expect(cost).toBe(20);
    });

    it('should calculate cost with per-request pricing', async () => {
      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0',
        userOutputPrice: '20.0',
        perRequestPrice: '0.5', // 0.5 credits per request
      };

      setupFindFirstMock(mockPricing);

      const cost = await service.calculateCost('gpt-4', 'openai', 1_000_000, 500_000);

      // Expected: 10 + 10 + 0.5 = 20.5
      expect(cost).toBe(20.5);
    });

    it('should handle zero tokens correctly', async () => {
      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0',
        userOutputPrice: '20.0',
        perRequestPrice: '0.0',
      };

      setupFindFirstMock(mockPricing);

      const cost = await service.calculateCost('gpt-4', 'openai', 0, 0);

      expect(cost).toBe(0);
    });

    it('should handle null pricing values as zero', async () => {
      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
      };

      setupFindFirstMock(mockPricing);

      const cost = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);

      expect(cost).toBe(0);
    });

    it('should calculate cost for small token amounts correctly', async () => {
      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0',
        userOutputPrice: '20.0',
        perRequestPrice: '0.0',
      };

      setupFindFirstMock(mockPricing);

      // 1000 input tokens + 500 output tokens
      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500);

      // Expected: (1000 / 1_000_000) * 10 + (500 / 1_000_000) * 20 = 0.01 + 0.01 = 0.02
      expect(cost).toBe(0.02);
    });

    it('should handle subProvider in pricing', async () => {
      const mockPricing = {
        model: 'deepseek-chat',
        provider: 'protochat',
        subProvider: 'deepseek',
        userInputPrice: '5.0',
        userOutputPrice: '10.0',
        perRequestPrice: '0.0',
      };

      setupFindFirstMock(mockPricing);

      const cost = await service.calculateCost('deepseek-chat', 'protochat', 1_000_000, 1_000_000);

      // Expected: (1_000_000 / 1_000_000) * 5 + (1_000_000 / 1_000_000) * 10 = 5 + 10 = 15
      expect(cost).toBe(15);
    });
  });

  describe('deductCredits', () => {
    it('should not deduct when amount is zero', async () => {
      await service.deductCredits(0, 'test');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should not deduct when amount is negative', async () => {
      await service.deductCredits(-10, 'test');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw error when user balance not found', async () => {
      setupTransactionMock(null);

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('User balance not found');
    });

    it('should throw error when insufficient credits', async () => {
      const mockBalance = {
        userId: userId,
        balance: '5.0',
        isUnlimited: false,
      };

      setupTransactionMock(mockBalance);

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('Insufficient credits');
    });

    it('should allow unlimited users to deduct credits regardless of balance', async () => {
      const mockBalance = {
        userId: userId,
        balance: '0.0',
        isUnlimited: true,
      };

      setupTransactionMock(mockBalance);

      const result = await service.deductCredits(10, 'test');

      expect(result).toBe(-10);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should deduct credits and update balance correctly', async () => {
      const mockBalance = {
        userId: userId,
        balance: '100.0',
        isUnlimited: false,
      };

      setupTransactionMock(mockBalance);

      const result = await service.deductCredits(25.5, 'test deduction');

      expect(result).toBe(74.5);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should create transaction record with correct values', async () => {
      const mockBalance = {
        userId: userId,
        balance: '100.0',
        isUnlimited: false,
      };

      const mockTx = setupTransactionMock(mockBalance);

      await service.deductCredits(10, 'test description', 'ref-123', { extra: 'data' });

      expect(mockTx.insert).toHaveBeenCalled();
      const insertCall = mockTx.insert.mock.results[0].value;
      expect(insertCall.values).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '-10.0000',
          balanceAfter: '90.0000',
          category: 'CONSUMPTION',
          description: 'test description',
          refId: 'ref-123',
          type: 'CONSUMPTION',
          userId: userId,
          metadata: { extra: 'data' },
        }),
      );
    });

    it('should handle decimal amounts correctly', async () => {
      const mockBalance = {
        userId: userId,
        balance: '50.5555',
        isUnlimited: false,
      };

      setupTransactionMock(mockBalance);

      const result = await service.deductCredits(10.1234, 'test');

      // Expected: 50.5555 - 10.1234 = 40.4321
      expect(result).toBeCloseTo(40.4321, 4);
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when balance not found', async () => {
      setupFindFirstMock(null);

      const result = await service.hasEnoughCredits(10);

      expect(result).toBe(false);
    });

    it('should return true for unlimited users regardless of balance', async () => {
      const mockBalance = {
        userId: userId,
        balance: '0.0',
        isUnlimited: true,
      };

      setupFindFirstMock(mockBalance);

      const result = await service.hasEnoughCredits(100);

      expect(result).toBe(true);
    });

    it('should return true when balance is greater than zero and no estimated amount provided', async () => {
      const mockBalance = {
        userId: userId,
        balance: '10.0',
        isUnlimited: false,
      };

      setupFindFirstMock(mockBalance);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(true);
    });

    it('should return false when balance is zero and no estimated amount provided', async () => {
      const mockBalance = {
        userId: userId,
        balance: '0.0',
        isUnlimited: false,
      };

      setupFindFirstMock(mockBalance);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when balance is sufficient for estimated amount', async () => {
      const mockBalance = {
        userId: userId,
        balance: '100.0',
        isUnlimited: false,
      };

      setupFindFirstMock(mockBalance);

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should return false when balance is insufficient for estimated amount', async () => {
      const mockBalance = {
        userId: userId,
        balance: '30.0',
        isUnlimited: false,
      };

      setupFindFirstMock(mockBalance);

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(false);
    });

    it('should return true when balance exactly equals estimated amount', async () => {
      const mockBalance = {
        userId: userId,
        balance: '50.0',
        isUnlimited: false,
      };

      setupFindFirstMock(mockBalance);

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should handle decimal balances and amounts correctly', async () => {
      const mockBalance = {
        userId: userId,
        balance: '25.5555',
        isUnlimited: false,
      };

      setupFindFirstMock(mockBalance);

      const result = await service.hasEnoughCredits(25.5556);

      expect(result).toBe(false);
    });
  });
});
