import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreditService } from '../index';

// Mock the database schemas (imported by CreditService)
vi.mock('@/database/schemas', () => ({
  userBalances: {},
  userTransactions: {},
  modelPricings: {},
}));

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val, op: 'eq' })),
  and: vi.fn((...conditions) => ({ conditions, op: 'and' })),
}));

// Mock idGenerator
vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn(() => 'tx_mockedid'),
}));

describe('CreditService', () => {
  let creditService: CreditService;
  let mockDb: any;
  const userId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();

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
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    };

    creditService = new CreditService(mockDb, userId);
  });

  // ---------------------------------------------------------------------------
  // calculateCost
  // ---------------------------------------------------------------------------
  describe('calculateCost', () => {
    it('should return 0 when user is using their own API config', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const cost = await creditService.calculateCost('gpt-4', 'openai', 1000, 500, true);

      expect(cost).toBe(0);
      expect(mockDb.query.modelPricings.findFirst).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should return 0 when no pricing is found for the model/provider', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockDb.query.modelPricings.findFirst.mockResolvedValue(null);

      const cost = await creditService.calculateCost('unknown-model', 'unknown-provider', 1000, 500);

      expect(cost).toBe(0);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No pricing found for unknown-provider::unknown-model'),
      );
      warnSpy.mockRestore();
    });

    it('should calculate cost based on input and output tokens', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10',   // 10 credits per 1M tokens
        userOutputPrice: '30',  // 30 credits per 1M tokens
        perRequestPrice: '0',
        subProvider: null,
      });

      // 1M input tokens → 10 credits, 1M output tokens → 30 credits
      const cost = await creditService.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);

      expect(cost).toBe(40); // 10 + 30
      logSpy.mockRestore();
    });

    it('should include per-request price in the cost', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '0',
        userOutputPrice: '0',
        perRequestPrice: '5',
        subProvider: null,
      });

      const cost = await creditService.calculateCost('gpt-4', 'openai', 100, 100);

      expect(cost).toBe(5);
      logSpy.mockRestore();
    });

    it('should handle fractional token amounts correctly', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'claude-3',
        provider: 'protochat',
        userInputPrice: '2',    // 2 credits per 1M tokens
        userOutputPrice: '6',   // 6 credits per 1M tokens
        perRequestPrice: '0',
        subProvider: null,
      });

      // 500k input = 1 credit, 500k output = 3 credits → total 4
      const cost = await creditService.calculateCost('claude-3', 'protochat', 500_000, 500_000);

      expect(cost).toBeCloseTo(4, 5);
      logSpy.mockRestore();
    });

    it('should default to 0 for missing price fields', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: null,
        userOutputPrice: undefined,
        perRequestPrice: null,
        subProvider: null,
      });

      const cost = await creditService.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);

      expect(cost).toBe(0);
      logSpy.mockRestore();
    });

    it('should not charge if isUserConfig is false by default', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10',
        userOutputPrice: '30',
        perRequestPrice: '0',
        subProvider: null,
      });

      // Default isUserConfig = false → should charge
      const cost = await creditService.calculateCost('gpt-4', 'openai', 1_000_000, 0);

      expect(cost).toBe(10);
      logSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // deductCredits
  // ---------------------------------------------------------------------------
  describe('deductCredits', () => {
    it('should not deduct if amount is 0', async () => {
      await creditService.deductCredits(0, 'test description');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should not deduct if amount is negative', async () => {
      await creditService.deductCredits(-5, 'test description');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw error when user balance record is not found', async () => {
      mockDb.transaction.mockImplementation(async (cb: (tx: any) => any) => {
        const tx = {
          query: { userBalances: { findFirst: vi.fn().mockResolvedValue(null) } },
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(undefined),
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockResolvedValue(undefined),
        };
        return cb(tx);
      });

      await expect(creditService.deductCredits(10, 'Chat completion')).rejects.toThrow(
        'User balance not found',
      );
    });

    it('should throw error when user has insufficient credits', async () => {
      mockDb.transaction.mockImplementation(async (cb: (tx: any) => any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId,
                balance: '5.0000',
                isUnlimited: false,
              }),
            },
          },
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(undefined),
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockResolvedValue(undefined),
        };
        return cb(tx);
      });

      await expect(creditService.deductCredits(10, 'Chat completion')).rejects.toThrow(
        'Insufficient credits',
      );
    });

    it('should successfully deduct credits from user balance', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockResolvedValue(undefined);

      mockDb.transaction.mockImplementation(async (cb: (tx: any) => any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId,
                balance: '100.0000',
                isUnlimited: false,
              }),
            },
          },
          update: mockUpdate,
          set: mockSet,
          where: mockWhere,
          insert: mockInsert,
          values: mockValues,
        };
        return cb(tx);
      });

      const result = await creditService.deductCredits(10, 'Chat completion: gpt-4', 'msg-123', {
        model: 'gpt-4',
        inputTokens: 1000,
      });

      expect(result).toBeCloseTo(90, 4);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          balance: '90.0000',
        }),
      );
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: (-10).toFixed(4),
          balanceAfter: '90.0000',
          category: 'CONSUMPTION',
          description: 'Chat completion: gpt-4',
          refId: 'msg-123',
          type: 'CONSUMPTION',
          userId,
        }),
      );
    });

    it('should deduct from unlimited balance without throwing insufficient credit error', async () => {
      mockDb.transaction.mockImplementation(async (cb: (tx: any) => any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId,
                balance: '0.0000',
                isUnlimited: true,
              }),
            },
          },
          update: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue(undefined),
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockResolvedValue(undefined),
        };
        return cb(tx);
      });

      // Should NOT throw even though balance is 0, because isUnlimited=true
      await expect(creditService.deductCredits(999, 'Unlimited user')).resolves.not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // hasEnoughCredits
  // ---------------------------------------------------------------------------
  describe('hasEnoughCredits', () => {
    it('should return false when user balance record is not found', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue(null);

      const result = await creditService.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when user has unlimited balance', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: true,
      });

      const result = await creditService.hasEnoughCredits(1000);

      expect(result).toBe(true);
    });

    it('should return false when balance is 0 and no estimated amount provided', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: false,
      });

      const result = await creditService.hasEnoughCredits(0);

      expect(result).toBe(false);
    });

    it('should return true when balance is positive and no estimated amount provided', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '50.0000',
        isUnlimited: false,
      });

      const result = await creditService.hasEnoughCredits();

      expect(result).toBe(true);
    });

    it('should return true when balance is greater than or equal to estimated amount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '100.0000',
        isUnlimited: false,
      });

      expect(await creditService.hasEnoughCredits(100)).toBe(true);
      expect(await creditService.hasEnoughCredits(50)).toBe(true);
    });

    it('should return false when balance is less than estimated amount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '5.0000',
        isUnlimited: false,
      });

      const result = await creditService.hasEnoughCredits(10);

      expect(result).toBe(false);
    });

    it('should return false when balance is exactly 0 with no estimated amount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: false,
      });

      // Default call with no args
      const result = await creditService.hasEnoughCredits();

      expect(result).toBe(false);
    });
  });
});
