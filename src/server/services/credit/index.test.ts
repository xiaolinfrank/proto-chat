// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';

import { CreditService } from './index';

vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn().mockReturnValue('tx-mock-id'),
}));

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: any;
  const userId = 'test-user-id';

  const makePricing = (overrides: Record<string, unknown> = {}) => ({
    id: 'pricing-1',
    model: 'gpt-4',
    provider: 'openai',
    inputPrice: '10',
    outputPrice: '30',
    userInputPrice: '10',
    userOutputPrice: '30',
    perRequestPrice: '0',
    subProvider: null,
    memo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    accessedAt: new Date(),
    ...overrides,
  });

  const makeBalance = (overrides: Record<string, unknown> = {}) => ({
    userId,
    balance: '100.0000',
    isUnlimited: false,
    totalPurchased: '100.0000',
    createdAt: new Date(),
    updatedAt: new Date(),
    accessedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      query: {
        modelPricings: { findFirst: vi.fn() },
        userBalances: { findFirst: vi.fn() },
      },
      transaction: vi.fn(),
    };

    service = new CreditService(mockDb as LobeChatDatabase, userId);
  });

  // ---------------------------------------------------------------------------
  // calculateCost
  // ---------------------------------------------------------------------------
  describe('calculateCost', () => {
    it('should return 0 when user is using their own config', async () => {
      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);
      expect(cost).toBe(0);
      expect(mockDb.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing is found for model/provider', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(undefined);

      const cost = await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);
      expect(cost).toBe(0);
    });

    it('should calculate cost correctly from token counts', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(
        makePricing({ userInputPrice: '10', userOutputPrice: '30', perRequestPrice: '0' }),
      );

      // 1,000,000 input tokens + 1,000,000 output tokens => 10 + 30 = 40 credits
      const cost = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(40);
    });

    it('should include perRequestPrice in cost', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(
        makePricing({ userInputPrice: '0', userOutputPrice: '0', perRequestPrice: '5' }),
      );

      const cost = await service.calculateCost('some-model', 'some-provider', 0, 0);
      expect(cost).toBe(5);
    });

    it('should handle missing/null price fields gracefully (default to 0)', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(
        makePricing({ userInputPrice: null, userOutputPrice: null, perRequestPrice: null }),
      );

      const cost = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);
      expect(cost).toBe(0);
    });

    it('should calculate fractional token costs correctly', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(
        makePricing({ userInputPrice: '1', userOutputPrice: '2', perRequestPrice: '0' }),
      );

      // 500,000 input + 250,000 output => 0.5 + 0.5 = 1.0 credits
      const cost = await service.calculateCost('claude-3', 'anthropic', 500_000, 250_000);
      expect(cost).toBeCloseTo(1.0);
    });

    it('should charge when isUserConfig is false (default) and pricing exists', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(
        makePricing({ userInputPrice: '10', userOutputPrice: '0', perRequestPrice: '0' }),
      );

      const cost = await service.calculateCost('gpt-4', 'openai', 1_000_000, 0);
      expect(cost).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // deductCredits
  // ---------------------------------------------------------------------------
  describe('deductCredits', () => {
    it('should do nothing when amount is 0', async () => {
      await service.deductCredits(0, 'test');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should do nothing when amount is negative', async () => {
      await service.deductCredits(-5, 'test');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw when user balance is not found', async () => {
      mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
        const tx = {
          query: { userBalances: { findFirst: vi.fn().mockResolvedValue(null) } },
        };
        return fn(tx);
      });

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('User balance not found');
    });

    it('should throw when user has insufficient credits', async () => {
      mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(makeBalance({ balance: '5.0000', isUnlimited: false })),
            },
          },
        };
        return fn(tx);
      });

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('Insufficient credits');
    });

    it('should deduct credits and return new balance', async () => {
      mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(makeBalance({ balance: '100.0000', isUnlimited: false })),
            },
          },
          update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) }),
          insert: vi.fn().mockReturnValue({ values: vi.fn() }),
        };
        return fn(tx);
      });

      const newBalance = await service.deductCredits(10, 'chat completion', 'msg-123');
      expect(newBalance).toBeCloseTo(90);
    });

    it('should allow deduction for unlimited users even when balance is 0', async () => {
      mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(makeBalance({ balance: '0.0000', isUnlimited: true })),
            },
          },
          update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) }),
          insert: vi.fn().mockReturnValue({ values: vi.fn() }),
        };
        return fn(tx);
      });

      const newBalance = await service.deductCredits(999, 'large request');
      expect(newBalance).toBeCloseTo(-999);
    });

    it('should pass metadata and refId to the transaction record', async () => {
      const insertValues = vi.fn();
      mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(makeBalance({ balance: '50.0000' })),
            },
          },
          update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) }),
          insert: vi.fn().mockReturnValue({ values: insertValues }),
        };
        return fn(tx);
      });

      const meta = { model: 'gpt-4', tokens: 1000 };
      await service.deductCredits(5, 'API usage', 'ref-456', meta);

      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'API usage',
          refId: 'ref-456',
          metadata: meta,
          type: 'CONSUMPTION',
          category: 'CONSUMPTION',
          userId,
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // hasEnoughCredits
  // ---------------------------------------------------------------------------
  describe('hasEnoughCredits', () => {
    it('should return false when user balance record does not exist', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue(null);

      expect(await service.hasEnoughCredits()).toBe(false);
    });

    it('should return true for unlimited users regardless of balance', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue(
        makeBalance({ balance: '0.0000', isUnlimited: true }),
      );

      expect(await service.hasEnoughCredits(1000)).toBe(true);
    });

    it('should return true when balance > 0 and no estimatedAmount provided', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue(
        makeBalance({ balance: '5.0000', isUnlimited: false }),
      );

      expect(await service.hasEnoughCredits()).toBe(true);
    });

    it('should return false when balance is 0 and no estimatedAmount provided', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue(
        makeBalance({ balance: '0.0000', isUnlimited: false }),
      );

      expect(await service.hasEnoughCredits()).toBe(false);
    });

    it('should return true when balance >= estimatedAmount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue(
        makeBalance({ balance: '10.0000', isUnlimited: false }),
      );

      expect(await service.hasEnoughCredits(10)).toBe(true);
    });

    it('should return false when balance < estimatedAmount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue(
        makeBalance({ balance: '9.9999', isUnlimited: false }),
      );

      expect(await service.hasEnoughCredits(10)).toBe(false);
    });

    it('should return true when estimatedAmount is 0 and balance > 0', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue(
        makeBalance({ balance: '1.0000', isUnlimited: false }),
      );

      expect(await service.hasEnoughCredits(0)).toBe(true);
    });
  });
});
