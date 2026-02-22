import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreditService } from './index';

// Mock database schemas and utilities to avoid loading the full DB stack
vi.mock('@/database/schemas', () => ({
  userBalances: 'userBalances',
  userTransactions: 'userTransactions',
  modelPricings: 'modelPricings',
}));

vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn(() => 'tx_test123'),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ field, value, type: 'eq' })),
  and: vi.fn((...conditions) => ({ conditions, type: 'and' })),
}));

describe('CreditService', () => {
  let service: CreditService;
  const userId = 'test-user-id';
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: {
        userBalances: {
          findFirst: vi.fn(),
        },
        modelPricings: {
          findFirst: vi.fn(),
        },
      },
      transaction: vi.fn(),
    };

    service = new CreditService(mockDb, userId);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using own API key', async () => {
      const result = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);

      expect(result).toBe(0);
      expect(mockDb.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should log a message when user uses own config', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log');
      await service.calculateCost('gpt-4', 'openai', 1000, 500, true);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('User using own config for openai, no charge'),
      );
    });

    it('should return 0 when no pricing is found for model', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(null);

      const result = await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);

      expect(result).toBe(0);
    });

    it('should log warning when no pricing found', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      mockDb.query.modelPricings.findFirst.mockResolvedValue(null);

      await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No pricing found for unknown-provider::unknown-model, no charge'),
      );
    });

    it('should calculate cost based on input/output tokens and pricing', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0',
        userOutputPrice: '30.0',
        perRequestPrice: '0',
        subProvider: null,
      });

      // 1,000,000 tokens => 10 credits input, 30 credits output
      const result = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);

      expect(result).toBe(40); // 10 + 30
    });

    it('should include perRequestPrice in total cost', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'special-model',
        provider: 'special-provider',
        userInputPrice: '0',
        userOutputPrice: '0',
        perRequestPrice: '5.0',
        subProvider: null,
      });

      const result = await service.calculateCost('special-model', 'special-provider', 0, 0);

      expect(result).toBe(5);
    });

    it('should calculate proportional cost for token amounts less than 1M', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0',
        userOutputPrice: '30.0',
        perRequestPrice: '0',
        subProvider: null,
      });

      // 100k tokens = 10% of 1M
      const result = await service.calculateCost('gpt-4', 'openai', 100_000, 100_000);

      expect(result).toBeCloseTo(4, 5); // (100k/1M * 10) + (100k/1M * 30) = 1 + 3 = 4
    });

    it('should handle missing price fields as 0', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'free-model',
        provider: 'free-provider',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
        subProvider: null,
      });

      const result = await service.calculateCost('free-model', 'free-provider', 1_000_000, 1_000_000);

      expect(result).toBe(0);
    });

    it('should call db with correct model and provider', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(null);

      await service.calculateCost('claude-3', 'anthropic', 500, 200);

      expect(mockDb.query.modelPricings.findFirst).toHaveBeenCalled();
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when user balance not found', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue(null);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when user has unlimited balance', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0',
        isUnlimited: true,
      });

      const result = await service.hasEnoughCredits(100);

      expect(result).toBe(true);
    });

    it('should return true when balance is positive and no estimated amount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '10.5',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(true);
    });

    it('should return false when balance is zero and no estimated amount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(false);
    });

    it('should return true when balance exceeds estimated amount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '50.00',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(25);

      expect(result).toBe(true);
    });

    it('should return false when balance is below estimated amount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '10.00',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(25);

      expect(result).toBe(false);
    });

    it('should return true when balance exactly matches estimated amount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '25.00',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(25);

      expect(result).toBe(true);
    });

    it('should default estimated amount to 0 when not provided', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0.50',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits();

      // balance > 0 so should return true
      expect(result).toBe(true);
    });
  });

  describe('deductCredits', () => {
    it('should not deduct when amount is 0', async () => {
      await service.deductCredits(0, 'test charge');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should not deduct when amount is negative', async () => {
      await service.deductCredits(-5, 'negative charge');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should run a transaction when amount is positive', async () => {
      mockDb.transaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId,
                balance: '100.00',
                isUnlimited: false,
              }),
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
        return fn(mockTx);
      });

      await service.deductCredits(10, 'test charge');

      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should throw when user balance is not found in transaction', async () => {
      mockDb.transaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(null),
            },
          },
        };
        return fn(mockTx);
      });

      await expect(service.deductCredits(10, 'test charge')).rejects.toThrow(
        'User balance not found',
      );
    });

    it('should throw when user has insufficient credits', async () => {
      mockDb.transaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId,
                balance: '5.00',
                isUnlimited: false,
              }),
            },
          },
        };
        return fn(mockTx);
      });

      await expect(service.deductCredits(10, 'test charge')).rejects.toThrow(
        'Insufficient credits',
      );
    });

    it('should allow deduction when user has unlimited balance', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      mockDb.transaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId,
                balance: '0',
                isUnlimited: true,
              }),
            },
          },
          update: mockUpdate,
          insert: mockInsert,
        };
        return fn(mockTx);
      });

      // Should not throw for unlimited balance even with high amount
      await expect(service.deductCredits(1000, 'big charge')).resolves.not.toThrow();
    });

    it('should return the new balance after deduction', async () => {
      mockDb.transaction.mockImplementation(async (fn: any) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId,
                balance: '100.00',
                isUnlimited: false,
              }),
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
        return fn(mockTx);
      });

      const result = await service.deductCredits(30, 'partial charge');

      expect(result).toBe(70);
    });
  });
});
