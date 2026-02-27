import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';
import { modelPricings, userBalances, userTransactions } from '@/database/schemas';
import { eq } from 'drizzle-orm';

import { CreditService } from './index';

// Mock the idGenerator
vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn((prefix: string) => `${prefix}-mock-id-${Date.now()}`),
}));

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: LobeChatDatabase;
  const userId = 'test-user-id';

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create fresh mock database for each test
    mockDb = {
      query: {
        modelPricings: {
          findFirst: vi.fn(),
        },
        userBalances: {
          findFirst: vi.fn(),
        },
      },
      transaction: vi.fn(),
      update: vi.fn(),
      insert: vi.fn(),
    } as unknown as LobeChatDatabase;

    service = new CreditService(mockDb, userId);
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using their own API key', async () => {
      const cost = await service.calculateCost(
        'gpt-4',
        'openai',
        1000,
        500,
        true // isUserConfig = true
      );

      expect(cost).toBe(0);
      // Should not query database when using own config
      expect(mockDb.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing found for model', async () => {
      vi.spyOn(mockDb.query.modelPricings, 'findFirst').mockResolvedValue(undefined);

      const cost = await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);

      expect(cost).toBe(0);
      expect(mockDb.query.modelPricings.findFirst).toHaveBeenCalled();
    });

    it('should calculate cost correctly with valid pricing', async () => {
      const mockPricing = {
        id: 'pricing-1',
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0000', // $10 per 1M tokens
        userOutputPrice: '30.0000', // $30 per 1M tokens
        perRequestPrice: '0.0010', // $0.001 per request
        inputPrice: '5.0000',
        outputPrice: '15.0000',
        subProvider: null,
        memo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      };

      vi.spyOn(mockDb.query.modelPricings, 'findFirst').mockResolvedValue(mockPricing);

      // Calculate: (1M / 1M) * 10 + (500K / 1M) * 30 + 0.001
      // = 1 * 10 + 0.5 * 30 + 0.001
      // = 10 + 15 + 0.001 = 25.001
      const cost = await service.calculateCost('gpt-4', 'openai', 1_000_000, 500_000);

      expect(cost).toBe(25.001);
    });

    it('should handle zero tokens correctly', async () => {
      const mockPricing = {
        id: 'pricing-1',
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0000',
        userOutputPrice: '30.0000',
        perRequestPrice: '0.0010',
        inputPrice: '5.0000',
        outputPrice: '15.0000',
        subProvider: null,
        memo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      };

      vi.spyOn(mockDb.query.modelPricings, 'findFirst').mockResolvedValue(mockPricing);

      const cost = await service.calculateCost('gpt-4', 'openai', 0, 0);

      // Should only charge per-request price
      expect(cost).toBe(0.001);
    });

    it('should handle missing price fields as zero', async () => {
      const mockPricing = {
        id: 'pricing-1',
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '0.0000',
        userOutputPrice: '0.0000',
        perRequestPrice: '0.0000',
        inputPrice: '5.0000',
        outputPrice: '15.0000',
        subProvider: null,
        memo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      };

      // Mock the pricing to return null strings to simulate missing values
      const mockPricingWithNulls = {
        ...mockPricing,
        userInputPrice: null as any,
        userOutputPrice: null as any,
        perRequestPrice: null as any,
      };

      vi.spyOn(mockDb.query.modelPricings, 'findFirst').mockResolvedValue(mockPricingWithNulls);

      const cost = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);

      expect(cost).toBe(0);
    });

    it('should calculate cost for model with sub-provider', async () => {
      const mockPricing = {
        id: 'pricing-1',
        model: 'deepseek/deepseek-chat-v3.1',
        provider: 'protochat',
        subProvider: 'openrouter',
        userInputPrice: '2.0000',
        userOutputPrice: '8.0000',
        perRequestPrice: '0.0005',
        inputPrice: '1.0000',
        outputPrice: '4.0000',
        memo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      };

      vi.spyOn(mockDb.query.modelPricings, 'findFirst').mockResolvedValue(mockPricing);

      // (2M / 1M) * 2 + (1M / 1M) * 8 + 0.0005
      // = 2 * 2 + 1 * 8 + 0.0005 = 12.0005
      const cost = await service.calculateCost(
        'deepseek/deepseek-chat-v3.1',
        'protochat',
        2_000_000,
        1_000_000
      );

      expect(cost).toBe(12.0005);
    });

    it('should handle small token amounts correctly', async () => {
      const mockPricing = {
        id: 'pricing-1',
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0000',
        userOutputPrice: '30.0000',
        perRequestPrice: '0.0000',
        inputPrice: '5.0000',
        outputPrice: '15.0000',
        subProvider: null,
        memo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      };

      vi.spyOn(mockDb.query.modelPricings, 'findFirst').mockResolvedValue(mockPricing);

      // Very small amounts: 100 input, 50 output tokens
      // (100 / 1M) * 10 + (50 / 1M) * 30
      // = 0.0001 * 10 + 0.00005 * 30
      // = 0.001 + 0.0015 = 0.0025
      const cost = await service.calculateCost('gpt-4', 'openai', 100, 50);

      expect(cost).toBeCloseTo(0.0025, 6);
    });
  });

  describe('deductCredits', () => {
    it('should not deduct when amount is zero', async () => {
      await service.deductCredits(0, 'Test description');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should not deduct when amount is negative', async () => {
      await service.deductCredits(-10, 'Test description');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw error when user balance not found', async () => {
      const mockTx = {
        query: {
          userBalances: {
            findFirst: vi.fn().mockResolvedValue(undefined),
          },
        },
      };

      vi.spyOn(mockDb, 'transaction').mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await expect(service.deductCredits(10, 'Test description')).rejects.toThrow(
        'User balance not found'
      );
    });

    it('should throw error when insufficient credits (non-unlimited user)', async () => {
      const mockBalance = {
        userId: userId,
        balance: '5.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      };

      const mockTx = {
        query: {
          userBalances: {
            findFirst: vi.fn().mockResolvedValue(mockBalance),
          },
        },
      };

      vi.spyOn(mockDb, 'transaction').mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await expect(service.deductCredits(10, 'Test description')).rejects.toThrow(
        'Insufficient credits'
      );
    });

    it('should successfully deduct credits for non-unlimited user with sufficient balance', async () => {
      const mockBalance = {
        userId: userId,
        balance: '100.0000',
        isUnlimited: false,
        totalPurchased: '200.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      };

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const mockTx = {
        query: {
          userBalances: {
            findFirst: vi.fn().mockResolvedValue(mockBalance),
          },
        },
        update: mockUpdate,
        insert: mockInsert,
      };

      vi.spyOn(mockDb, 'transaction').mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      const result = await service.deductCredits(25.5, 'Model usage', 'msg-123', {
        model: 'gpt-4',
      });

      expect(result).toBe(74.5); // 100 - 25.5

      // Verify balance update was called
      expect(mockUpdate).toHaveBeenCalledWith(userBalances);

      // Verify transaction record was inserted
      expect(mockInsert).toHaveBeenCalledWith(userTransactions);
    });

    it('should allow deduction for unlimited user regardless of balance', async () => {
      const mockBalance = {
        userId: userId,
        balance: '0.0000',
        isUnlimited: true,
        totalPurchased: '0.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      };

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const mockTx = {
        query: {
          userBalances: {
            findFirst: vi.fn().mockResolvedValue(mockBalance),
          },
        },
        update: mockUpdate,
        insert: mockInsert,
      };

      vi.spyOn(mockDb, 'transaction').mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      const result = await service.deductCredits(50, 'Model usage');

      expect(result).toBe(-50); // 0 - 50 (unlimited users can go negative)
    });

    it('should handle decimal precision correctly (4 decimal places)', async () => {
      const mockBalance = {
        userId: userId,
        balance: '10.1234',
        isUnlimited: false,
        totalPurchased: '50.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      };

      let capturedBalanceUpdate: any;
      let capturedTransactionInsert: any;

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((values: any) => {
          capturedBalanceUpdate = values;
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((values: any) => {
          capturedTransactionInsert = values;
          return Promise.resolve(undefined);
        }),
      });

      const mockTx = {
        query: {
          userBalances: {
            findFirst: vi.fn().mockResolvedValue(mockBalance),
          },
        },
        update: mockUpdate,
        insert: mockInsert,
      };

      vi.spyOn(mockDb, 'transaction').mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await service.deductCredits(3.5678, 'Test');

      // Check that balance is formatted to 4 decimal places
      expect(capturedBalanceUpdate.balance).toBe('6.5556'); // 10.1234 - 3.5678
      expect(capturedTransactionInsert.amount).toBe('-3.5678');
      expect(capturedTransactionInsert.balanceAfter).toBe('6.5556');
    });

    it('should create transaction record with correct metadata', async () => {
      const mockBalance = {
        userId: userId,
        balance: '100.0000',
        isUnlimited: false,
        totalPurchased: '200.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      };

      let capturedTransaction: any;

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((values: any) => {
          capturedTransaction = values;
          return Promise.resolve(undefined);
        }),
      });

      const mockTx = {
        query: {
          userBalances: {
            findFirst: vi.fn().mockResolvedValue(mockBalance),
          },
        },
        update: mockUpdate,
        insert: mockInsert,
      };

      vi.spyOn(mockDb, 'transaction').mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      const metadata = { model: 'gpt-4', provider: 'openai', tokens: 1500 };
      await service.deductCredits(15.5, 'AI Model Usage', 'msg-456', metadata);

      expect(capturedTransaction).toMatchObject({
        userId: userId,
        amount: '-15.5000',
        balanceAfter: '84.5000',
        type: 'CONSUMPTION',
        category: 'CONSUMPTION',
        description: 'AI Model Usage',
        refId: 'msg-456',
        metadata: metadata,
      });
      expect(capturedTransaction.id).toMatch(/^tx-mock-id-/);
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when user balance not found', async () => {
      vi.spyOn(mockDb.query.userBalances, 'findFirst').mockResolvedValue(undefined);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true for unlimited user regardless of balance', async () => {
      const mockBalance = {
        userId: userId,
        balance: '0.0000',
        isUnlimited: true,
        totalPurchased: '0.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      };

      vi.spyOn(mockDb.query.userBalances, 'findFirst').mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(1000);

      expect(result).toBe(true);
    });

    it('should return true when balance is positive and no estimated amount provided', async () => {
      const mockBalance = {
        userId: userId,
        balance: '5.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      };

      vi.spyOn(mockDb.query.userBalances, 'findFirst').mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(true);
    });

    it('should return false when balance is zero and no estimated amount provided', async () => {
      const mockBalance = {
        userId: userId,
        balance: '0.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      };

      vi.spyOn(mockDb.query.userBalances, 'findFirst').mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when balance exceeds estimated amount', async () => {
      const mockBalance = {
        userId: userId,
        balance: '50.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      };

      vi.spyOn(mockDb.query.userBalances, 'findFirst').mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(25.5);

      expect(result).toBe(true);
    });

    it('should return true when balance exactly equals estimated amount', async () => {
      const mockBalance = {
        userId: userId,
        balance: '25.5000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      };

      vi.spyOn(mockDb.query.userBalances, 'findFirst').mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(25.5);

      expect(result).toBe(true);
    });

    it('should return false when balance is less than estimated amount', async () => {
      const mockBalance = {
        userId: userId,
        balance: '10.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      };

      vi.spyOn(mockDb.query.userBalances, 'findFirst').mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(15.5);

      expect(result).toBe(false);
    });

    it('should handle very small amounts correctly', async () => {
      const mockBalance = {
        userId: userId,
        balance: '0.0010',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
      };

      vi.spyOn(mockDb.query.userBalances, 'findFirst').mockResolvedValue(mockBalance);

      const resultEnough = await service.hasEnoughCredits(0.0001);
      const resultNotEnough = await service.hasEnoughCredits(0.0020);

      expect(resultEnough).toBe(true);
      expect(resultNotEnough).toBe(false);
    });
  });
});
