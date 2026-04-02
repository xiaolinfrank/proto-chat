import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';

import { CreditService } from './index';

vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn(() => 'tx-mock-id'),
}));

const makePricing = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'pricing-1',
    model: 'gpt-4',
    provider: 'openai',
    userInputPrice: '0',
    userOutputPrice: '0',
    perRequestPrice: '0',
    inputPrice: '0',
    outputPrice: '0',
    subProvider: null,
    memo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    accessedAt: new Date(),
    ...overrides,
  }) as any;

const makeBalance = (overrides: Record<string, unknown> = {}) =>
  ({
    userId: 'test-user-id',
    balance: '100.0000',
    isUnlimited: false,
    totalPurchased: '0',
    createdAt: new Date(),
    updatedAt: new Date(),
    accessedAt: new Date(),
    ...overrides,
  }) as any;

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: any;
  const userId = 'test-user-id';

  beforeEach(() => {
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
    };

    service = new CreditService(mockDb as LobeChatDatabase, userId);
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using own config', async () => {
      const result = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);
      expect(result).toBe(0);
      expect(mockDb.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing found', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(undefined);

      const result = await service.calculateCost('gpt-4', 'openai', 1000, 500);
      expect(result).toBe(0);
    });

    it('should calculate cost correctly with pricing data', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(
        makePricing({ userInputPrice: '10', userOutputPrice: '20', perRequestPrice: '0' }),
      );

      // 1_000_000 input tokens + 1_000_000 output tokens
      const result = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);
      // cost = 1 * 10 + 1 * 20 + 0 = 30
      expect(result).toBe(30);
    });

    it('should include perRequestPrice in cost', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(
        makePricing({ userInputPrice: '0', userOutputPrice: '0', perRequestPrice: '5' }),
      );

      const result = await service.calculateCost('gpt-4', 'openai', 100, 100);
      expect(result).toBe(5);
    });

    it('should handle missing price fields as 0', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(
        makePricing({ userInputPrice: '0', userOutputPrice: '0', perRequestPrice: '0' }),
      );

      const result = await service.calculateCost('gpt-4', 'openai', 1000, 500);
      expect(result).toBe(0);
    });

    it('should calculate fractional token costs correctly', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(
        makePricing({ userInputPrice: '6', userOutputPrice: '12', perRequestPrice: '0' }),
      );

      // 500_000 input + 250_000 output
      const result = await service.calculateCost('gpt-4', 'openai', 500_000, 250_000);
      // cost = 0.5 * 6 + 0.25 * 12 = 3 + 3 = 6
      expect(result).toBe(6);
    });

    it('should default isUserConfig to false', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(undefined);

      const result = await service.calculateCost('gpt-4', 'openai', 100, 100);
      expect(mockDb.query.modelPricings.findFirst).toHaveBeenCalled();
      expect(result).toBe(0);
    });
  });

  describe('deductCredits', () => {
    it('should do nothing when amount is 0', async () => {
      await service.deductCredits(0, 'test');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should do nothing when amount is negative', async () => {
      await service.deductCredits(-5, 'test');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw when user balance not found', async () => {
      vi.mocked(mockDb.transaction).mockImplementation(async (fn: any) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(undefined),
            },
          },
        };
        return fn(mockTx);
      });

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('User balance not found');
    });

    it('should throw when user has insufficient credits', async () => {
      vi.mocked(mockDb.transaction).mockImplementation(async (fn: any) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(makeBalance({ balance: '5.0000' })),
            },
          },
          update: vi.fn(),
          insert: vi.fn(),
        };
        return fn(mockTx);
      });

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('Insufficient credits');
    });

    it('should deduct credits and record transaction for sufficient balance', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      });
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      vi.mocked(mockDb.transaction).mockImplementation(async (fn: any) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(makeBalance({ balance: '100.0000' })),
            },
          },
          update: mockUpdate,
          insert: mockInsert,
        };
        return fn(mockTx);
      });

      const result = await service.deductCredits(30, 'chat completion');
      expect(result).toBe(70);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should allow deduction for unlimited accounts even with low balance', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      });
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      vi.mocked(mockDb.transaction).mockImplementation(async (fn: any) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi
                .fn()
                .mockResolvedValue(makeBalance({ balance: '0.0000', isUnlimited: true })),
            },
          },
          update: mockUpdate,
          insert: mockInsert,
        };
        return fn(mockTx);
      });

      const result = await service.deductCredits(100, 'chat completion');
      expect(result).toBe(-100);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should record transaction with correct negative amount and fields', async () => {
      let insertedValues: any;
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((vals: any) => {
          insertedValues = vals;
          return Promise.resolve(undefined);
        }),
      });

      vi.mocked(mockDb.transaction).mockImplementation(async (fn: any) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(makeBalance({ balance: '50.0000' })),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
          }),
          insert: mockInsert,
        };
        return fn(mockTx);
      });

      await service.deductCredits(10, 'test description', 'ref-123');

      expect(insertedValues.amount).toBe('-10.0000');
      expect(insertedValues.balanceAfter).toBe('40.0000');
      expect(insertedValues.category).toBe('CONSUMPTION');
      expect(insertedValues.type).toBe('CONSUMPTION');
      expect(insertedValues.userId).toBe(userId);
      expect(insertedValues.description).toBe('test description');
      expect(insertedValues.refId).toBe('ref-123');
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when balance not found', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(undefined);

      const result = await service.hasEnoughCredits();
      expect(result).toBe(false);
    });

    it('should return true when balance is unlimited', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(
        makeBalance({ isUnlimited: true }),
      );

      const result = await service.hasEnoughCredits(1000);
      expect(result).toBe(true);
    });

    it('should return true when balance > 0 and no estimated amount', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(
        makeBalance({ balance: '10.0000' }),
      );

      const result = await service.hasEnoughCredits(0);
      expect(result).toBe(true);
    });

    it('should return false when balance is 0 and no estimated amount', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(
        makeBalance({ balance: '0.0000' }),
      );

      const result = await service.hasEnoughCredits(0);
      expect(result).toBe(false);
    });

    it('should return true when balance >= estimated amount', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(
        makeBalance({ balance: '50.0000' }),
      );

      expect(await service.hasEnoughCredits(50)).toBe(true);
      expect(await service.hasEnoughCredits(49.9999)).toBe(true);
    });

    it('should return false when balance < estimated amount', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(
        makeBalance({ balance: '50.0000' }),
      );

      const result = await service.hasEnoughCredits(50.0001);
      expect(result).toBe(false);
    });

    it('should default estimatedAmount to 0 when not provided', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(
        makeBalance({ balance: '5.0000' }),
      );

      const result = await service.hasEnoughCredits();
      expect(result).toBe(true);
    });
  });
});
