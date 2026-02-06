import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, and } from 'drizzle-orm';

import { CreditService } from './index';
import { LobeChatDatabase } from '@/database/type';
import { userBalances, userTransactions, modelPricings } from '@/database/schemas';
import { idGenerator } from '@/database/utils/idGenerator';

// Mock the idGenerator
vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn((prefix: string) => `${prefix}_mock_id_${Date.now()}`),
}));

describe('CreditService', () => {
  let mockDb: any;
  let creditService: CreditService;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a mock database with query and transaction methods
    mockDb = {
      query: {
        modelPricings: {
          findFirst: vi.fn(),
        },
        userBalances: {
          findFirst: vi.fn(),
        },
      },
      transaction: vi.fn(async (callback) => {
        // Create a mock transaction that has same structure as db
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn(),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
          }),
        };
        return callback(tx);
      }),
    };

    creditService = new CreditService(mockDb as unknown as LobeChatDatabase, testUserId);
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using their own config', async () => {
      const cost = await creditService.calculateCost(
        'gpt-4',
        'openai',
        1000,
        500,
        true // isUserConfig
      );

      expect(cost).toBe(0);
      expect(mockDb.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing found for model', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(null);

      const cost = await creditService.calculateCost('unknown-model', 'openai', 1000, 500);

      expect(cost).toBe(0);
      expect(mockDb.query.modelPricings.findFirst).toHaveBeenCalledWith({
        where: expect.anything(),
      });
    });

    it('should calculate cost correctly with valid pricing', async () => {
      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0000', // per 1M tokens
        userOutputPrice: '30.0000', // per 1M tokens
        perRequestPrice: '0.0010',
        subProvider: null,
      };

      mockDb.query.modelPricings.findFirst.mockResolvedValue(mockPricing);

      const inputTokens = 1_000_000; // 1M tokens
      const outputTokens = 500_000; // 0.5M tokens
      const cost = await creditService.calculateCost('gpt-4', 'openai', inputTokens, outputTokens);

      // Expected: (1M / 1M) * 10 + (0.5M / 1M) * 30 + 0.001 = 10 + 15 + 0.001 = 25.001
      expect(cost).toBeCloseTo(25.001, 3);
    });

    it('should handle zero tokens correctly', async () => {
      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0000',
        userOutputPrice: '30.0000',
        perRequestPrice: '0.0010',
        subProvider: null,
      };

      mockDb.query.modelPricings.findFirst.mockResolvedValue(mockPricing);

      const cost = await creditService.calculateCost('gpt-4', 'openai', 0, 0);

      // Should only charge per-request price
      expect(cost).toBeCloseTo(0.001, 3);
    });

    it('should handle pricing with sub-provider', async () => {
      const mockPricing = {
        model: 'deepseek-chat',
        provider: 'protochat',
        userInputPrice: '0.1400',
        userOutputPrice: '0.2800',
        perRequestPrice: '0.0000',
        subProvider: 'deepseek',
      };

      mockDb.query.modelPricings.findFirst.mockResolvedValue(mockPricing);

      const inputTokens = 10_000_000; // 10M tokens
      const outputTokens = 5_000_000; // 5M tokens
      const cost = await creditService.calculateCost(
        'deepseek-chat',
        'protochat',
        inputTokens,
        outputTokens
      );

      // Expected: (10M / 1M) * 0.14 + (5M / 1M) * 0.28 = 1.4 + 1.4 = 2.8
      expect(cost).toBeCloseTo(2.8, 3);
    });

    it('should handle null or undefined pricing values', async () => {
      const mockPricing = {
        model: 'test-model',
        provider: 'test-provider',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
        subProvider: null,
      };

      mockDb.query.modelPricings.findFirst.mockResolvedValue(mockPricing);

      const cost = await creditService.calculateCost('test-model', 'test-provider', 1000, 500);

      expect(cost).toBe(0);
    });

    it('should handle very small token amounts', async () => {
      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0000',
        userOutputPrice: '30.0000',
        perRequestPrice: '0.0000',
        subProvider: null,
      };

      mockDb.query.modelPricings.findFirst.mockResolvedValue(mockPricing);

      // 100 tokens is 0.0001 of 1M tokens
      const cost = await creditService.calculateCost('gpt-4', 'openai', 100, 100);

      // Expected: (100 / 1M) * 10 + (100 / 1M) * 30 = 0.001 + 0.003 = 0.004
      expect(cost).toBeCloseTo(0.004, 6);
    });
  });

  describe('deductCredits', () => {
    it('should not deduct when amount is zero', async () => {
      await creditService.deductCredits(0, 'test');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should not deduct when amount is negative', async () => {
      await creditService.deductCredits(-10, 'test');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw error when user balance not found', async () => {
      mockDb.transaction.mockImplementation(async (callback: any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(null),
            },
          },
          update: vi.fn(),
          insert: vi.fn(),
        };
        return callback(tx);
      });

      await expect(creditService.deductCredits(10, 'test')).rejects.toThrow(
        'User balance not found'
      );
    });

    it('should throw error when insufficient credits', async () => {
      mockDb.transaction.mockImplementation(async (callback: any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId: testUserId,
                balance: '5.0000',
                isUnlimited: false,
                totalPurchased: '100.0000',
              }),
            },
          },
          update: vi.fn(),
          insert: vi.fn(),
        };
        return callback(tx);
      });

      await expect(creditService.deductCredits(10, 'test')).rejects.toThrow('Insufficient credits');
    });

    it('should successfully deduct credits and create transaction', async () => {
      const mockBalance = {
        userId: testUserId,
        balance: '100.0000',
        isUnlimited: false,
        totalPurchased: '200.0000',
      };

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      mockDb.transaction.mockImplementation(async (callback: any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(mockBalance),
            },
          },
          update: mockUpdate,
          insert: mockInsert,
        };
        return callback(tx);
      });

      const result = await creditService.deductCredits(25, 'Test consumption', 'ref-123', {
        model: 'gpt-4',
      });

      expect(result).toBeCloseTo(75, 4);
      expect(mockUpdate).toHaveBeenCalledWith(userBalances);
      expect(mockInsert).toHaveBeenCalledWith(userTransactions);
    });

    it('should allow deduction for unlimited users', async () => {
      const mockBalance = {
        userId: testUserId,
        balance: '0.0000',
        isUnlimited: true,
        totalPurchased: '0.0000',
      };

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      mockDb.transaction.mockImplementation(async (callback: any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(mockBalance),
            },
          },
          update: mockUpdate,
          insert: mockInsert,
        };
        return callback(tx);
      });

      const result = await creditService.deductCredits(1000, 'Test unlimited');

      expect(result).toBeCloseTo(-1000, 4);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should handle edge case of exact balance deduction', async () => {
      const mockBalance = {
        userId: testUserId,
        balance: '50.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
      };

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      mockDb.transaction.mockImplementation(async (callback: any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(mockBalance),
            },
          },
          update: mockUpdate,
          insert: mockInsert,
        };
        return callback(tx);
      });

      const result = await creditService.deductCredits(50, 'Exact deduction');

      expect(result).toBeCloseTo(0, 4);
    });

    it('should properly format transaction amount as negative', async () => {
      const mockBalance = {
        userId: testUserId,
        balance: '100.0000',
        isUnlimited: false,
        totalPurchased: '200.0000',
      };

      let insertedTransaction: any;
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((values) => {
          insertedTransaction = values;
          return Promise.resolve();
        }),
      });

      mockDb.transaction.mockImplementation(async (callback: any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(mockBalance),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
          insert: mockInsert,
        };
        return callback(tx);
      });

      await creditService.deductCredits(25.5, 'Test transaction format');

      expect(insertedTransaction).toBeDefined();
      expect(insertedTransaction.amount).toBe('-25.5000');
      expect(insertedTransaction.balanceAfter).toBe('74.5000');
      expect(insertedTransaction.userId).toBe(testUserId);
      expect(insertedTransaction.category).toBe('CONSUMPTION');
      expect(insertedTransaction.type).toBe('CONSUMPTION');
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when user balance not found', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue(null);

      const result = await creditService.hasEnoughCredits(10);

      expect(result).toBe(false);
    });

    it('should return true for unlimited users', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId: testUserId,
        balance: '0.0000',
        isUnlimited: true,
        totalPurchased: '0.0000',
      });

      const result = await creditService.hasEnoughCredits(1000);

      expect(result).toBe(true);
    });

    it('should return true when balance is sufficient', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId: testUserId,
        balance: '100.0000',
        isUnlimited: false,
        totalPurchased: '200.0000',
      });

      const result = await creditService.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should return false when balance is insufficient', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId: testUserId,
        balance: '10.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
      });

      const result = await creditService.hasEnoughCredits(50);

      expect(result).toBe(false);
    });

    it('should return true when checking with exact balance', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId: testUserId,
        balance: '50.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
      });

      const result = await creditService.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should check for positive balance when estimatedAmount is 0', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId: testUserId,
        balance: '0.0001',
        isUnlimited: false,
        totalPurchased: '100.0000',
      });

      const result = await creditService.hasEnoughCredits(0);

      expect(result).toBe(true);
    });

    it('should return false when balance is zero and estimatedAmount is 0', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId: testUserId,
        balance: '0.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
      });

      const result = await creditService.hasEnoughCredits(0);

      expect(result).toBe(false);
    });

    it('should return false when balance is negative', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId: testUserId,
        balance: '-10.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
      });

      const result = await creditService.hasEnoughCredits(0);

      expect(result).toBe(false);
    });

    it('should handle very small balance amounts', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId: testUserId,
        balance: '0.0001',
        isUnlimited: false,
        totalPurchased: '100.0000',
      });

      const result = await creditService.hasEnoughCredits(0.0001);

      expect(result).toBe(true);
    });

    it('should default to 0 when estimatedAmount not provided', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId: testUserId,
        balance: '5.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
      });

      const result = await creditService.hasEnoughCredits();

      expect(result).toBe(true);
    });
  });
});
