import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreditService } from './index';

vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn(() => 'tx_mockid123456'),
}));

vi.mock('@/database/schemas', () => ({
  userBalances: { userId: 'userId' },
  userTransactions: {},
  modelPricings: { model: 'model', provider: 'provider' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ field, value, op: 'eq' })),
  and: vi.fn((...args) => ({ args, op: 'and' })),
}));

const mockUserId = 'user_test123';

const createMockDb = (overrides?: Partial<ReturnType<typeof buildMockDb>>) => {
  return { ...buildMockDb(), ...overrides };
};

const buildMockDb = () => {
  const mockUpdate = vi.fn().mockReturnThis();
  const mockSet = vi.fn().mockReturnThis();
  const mockWhere = vi.fn().mockResolvedValue(undefined);

  const mockInsert = vi.fn().mockReturnThis();
  const mockValues = vi.fn().mockResolvedValue(undefined);

  const mockTransaction = vi.fn(async (fn: (tx: any) => Promise<any>) => {
    const tx = {
      query: {
        userBalances: { findFirst: vi.fn() },
      },
      update: vi.fn(() => ({ set: mockSet })),
      insert: vi.fn(() => ({ values: mockValues })),
    };
    mockSet.mockReturnValue({ where: mockWhere });
    return fn(tx);
  });

  return {
    query: {
      modelPricings: { findFirst: vi.fn() },
      userBalances: { findFirst: vi.fn() },
    },
    update: vi.fn(() => ({ set: mockSet })),
    insert: vi.fn(() => ({ values: mockValues })),
    transaction: mockTransaction,
    _mockSet: mockSet,
    _mockWhere: mockWhere,
    _mockValues: mockValues,
  };
};

describe('CreditService', () => {
  let db: ReturnType<typeof buildMockDb>;
  let service: CreditService;

  beforeEach(() => {
    db = buildMockDb();
    service = new CreditService(db as any, mockUserId);
    vi.clearAllMocks();
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using their own API key', async () => {
      const result = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);
      expect(result).toBe(0);
      expect(db.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing found for model/provider', async () => {
      db.query.modelPricings.findFirst.mockResolvedValue(null);
      const result = await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);
      expect(result).toBe(0);
    });

    it('should calculate cost correctly based on token counts', async () => {
      db.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '30',
        userOutputPrice: '60',
        perRequestPrice: '0',
        subProvider: null,
      });

      // 1M input tokens at $30/M + 1M output tokens at $60/M = $90
      const result = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);
      expect(result).toBeCloseTo(90, 4);
    });

    it('should include per-request price in the cost', async () => {
      db.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '0',
        userOutputPrice: '0',
        perRequestPrice: '0.5',
        subProvider: null,
      });

      const result = await service.calculateCost('gpt-4', 'openai', 100, 100);
      expect(result).toBeCloseTo(0.5, 4);
    });

    it('should handle missing price fields by defaulting to 0', async () => {
      db.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
        subProvider: null,
      });

      const result = await service.calculateCost('gpt-4', 'openai', 1000, 1000);
      expect(result).toBe(0);
    });

    it('should return 0 when isUserConfig is not provided (default false) but no pricing exists', async () => {
      db.query.modelPricings.findFirst.mockResolvedValue(null);
      const result = await service.calculateCost('some-model', 'some-provider', 100, 200);
      expect(result).toBe(0);
    });

    it('should calculate partial token counts correctly (fractional millions)', async () => {
      db.query.modelPricings.findFirst.mockResolvedValue({
        model: 'claude-3',
        provider: 'anthropic',
        userInputPrice: '10',
        userOutputPrice: '30',
        perRequestPrice: '0',
        subProvider: null,
      });

      // 500k input tokens at $10/M = $5, 500k output at $30/M = $15 => $20
      const result = await service.calculateCost('claude-3', 'anthropic', 500_000, 500_000);
      expect(result).toBeCloseTo(20, 4);
    });
  });

  describe('deductCredits', () => {
    it('should do nothing when amount is 0', async () => {
      await service.deductCredits(0, 'test');
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('should do nothing when amount is negative', async () => {
      await service.deductCredits(-5, 'test');
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('should throw when user balance record is not found', async () => {
      db.transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          query: { userBalances: { findFirst: vi.fn().mockResolvedValue(null) } },
          update: vi.fn(),
          insert: vi.fn(),
        };
        return fn(tx);
      });

      await expect(service.deductCredits(10, 'test charge')).rejects.toThrow('User balance not found');
    });

    it('should throw when user has insufficient credits', async () => {
      db.transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId: mockUserId,
                balance: '5.0000',
                isUnlimited: false,
              }),
            },
          },
          update: vi.fn(),
          insert: vi.fn(),
        };
        return fn(tx);
      });

      await expect(service.deductCredits(10, 'test charge')).rejects.toThrow('Insufficient credits');
    });

    it('should deduct credits and record transaction for a regular user', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockInsert = vi.fn().mockReturnThis();
      const mockValues = vi.fn().mockResolvedValue(undefined);

      mockSet.mockReturnValue({ where: mockWhere });

      db.transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId: mockUserId,
                balance: '100.0000',
                isUnlimited: false,
              }),
            },
          },
          update: vi.fn(() => ({ set: mockSet })),
          insert: vi.fn(() => ({ values: mockValues })),
        };
        return fn(tx);
      });

      const result = await service.deductCredits(10, 'API usage');
      expect(result).toBeCloseTo(90, 4);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '-10.0000',
          balanceAfter: '90.0000',
          category: 'CONSUMPTION',
          description: 'API usage',
          type: 'CONSUMPTION',
          userId: mockUserId,
        }),
      );
    });

    it('should skip balance check for unlimited users and allow deduction', async () => {
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockValues = vi.fn().mockResolvedValue(undefined);
      mockSet.mockReturnValue({ where: mockWhere });

      db.transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId: mockUserId,
                balance: '0.0000',
                isUnlimited: true,
              }),
            },
          },
          update: vi.fn(() => ({ set: mockSet })),
          insert: vi.fn(() => ({ values: mockValues })),
        };
        return fn(tx);
      });

      // Unlimited user with 0 balance should still be able to deduct
      const result = await service.deductCredits(50, 'Premium model usage');
      expect(result).toBeCloseTo(-50, 4);
      expect(mockValues).toHaveBeenCalled();
    });

    it('should pass refId and metadata to transaction record', async () => {
      const mockSet = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockValues = vi.fn().mockResolvedValue(undefined);
      mockSet.mockReturnValue({ where: mockWhere });

      db.transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId: mockUserId,
                balance: '200.0000',
                isUnlimited: false,
              }),
            },
          },
          update: vi.fn(() => ({ set: mockSet })),
          insert: vi.fn(() => ({ values: mockValues })),
        };
        return fn(tx);
      });

      const metadata = { model: 'gpt-4', tokens: 1000 };
      await service.deductCredits(5, 'Chat completion', 'msg_abc123', metadata);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          refId: 'msg_abc123',
          metadata,
        }),
      );
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when balance record is not found', async () => {
      db.query.userBalances.findFirst.mockResolvedValue(null);
      const result = await service.hasEnoughCredits();
      expect(result).toBe(false);
    });

    it('should return true for unlimited users regardless of balance', async () => {
      db.query.userBalances.findFirst.mockResolvedValue({
        userId: mockUserId,
        balance: '0.0000',
        isUnlimited: true,
      });
      const result = await service.hasEnoughCredits(9999);
      expect(result).toBe(true);
    });

    it('should return false when balance is 0 and no estimated amount provided', async () => {
      db.query.userBalances.findFirst.mockResolvedValue({
        userId: mockUserId,
        balance: '0.0000',
        isUnlimited: false,
      });
      const result = await service.hasEnoughCredits();
      expect(result).toBe(false);
    });

    it('should return true when balance is positive and no estimated amount provided', async () => {
      db.query.userBalances.findFirst.mockResolvedValue({
        userId: mockUserId,
        balance: '5.0000',
        isUnlimited: false,
      });
      const result = await service.hasEnoughCredits();
      expect(result).toBe(true);
    });

    it('should return true when balance meets the estimated amount', async () => {
      db.query.userBalances.findFirst.mockResolvedValue({
        userId: mockUserId,
        balance: '10.0000',
        isUnlimited: false,
      });
      const result = await service.hasEnoughCredits(10);
      expect(result).toBe(true);
    });

    it('should return false when balance is less than estimated amount', async () => {
      db.query.userBalances.findFirst.mockResolvedValue({
        userId: mockUserId,
        balance: '9.9999',
        isUnlimited: false,
      });
      const result = await service.hasEnoughCredits(10);
      expect(result).toBe(false);
    });

    it('should return true when balance exceeds estimated amount', async () => {
      db.query.userBalances.findFirst.mockResolvedValue({
        userId: mockUserId,
        balance: '50.0000',
        isUnlimited: false,
      });
      const result = await service.hasEnoughCredits(10);
      expect(result).toBe(true);
    });

    it('should handle estimatedAmount of 0 correctly', async () => {
      db.query.userBalances.findFirst.mockResolvedValue({
        userId: mockUserId,
        balance: '1.0000',
        isUnlimited: false,
      });
      const result = await service.hasEnoughCredits(0);
      expect(result).toBe(true);
    });
  });
});
