import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreditService } from './index';

// Mock table schema objects (only used as identifiers in drizzle queries)
vi.mock('@/database/schemas', () => ({
  modelPricings: { model: 'model', provider: 'provider' },
  userBalances: { userId: 'userId', balance: 'balance' },
  userTransactions: {},
}));

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions) => ({ conditions, type: 'and' })),
  eq: vi.fn((col, val) => ({ col, type: 'eq', val })),
}));

// Mock idGenerator to return predictable IDs
vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn(() => 'tx_mockid12345'),
}));

const makeDb = (overrides: Partial<ReturnType<typeof buildDb>> = {}) => buildDb(overrides);

function buildDb(overrides: Record<string, any> = {}) {
  const mockWhere = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
  const mockValues = vi.fn().mockResolvedValue(undefined);
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

  const mockTx = {
    insert: mockInsert,
    query: {
      userBalances: {
        findFirst: vi.fn(),
      },
    },
    update: mockUpdate,
  };

  const mockDb = {
    query: {
      modelPricings: {
        findFirst: vi.fn(),
      },
      userBalances: {
        findFirst: vi.fn(),
      },
    },
    transaction: vi.fn().mockImplementation(async (callback: (tx: typeof mockTx) => Promise<any>) =>
      callback(mockTx),
    ),
    _mockTx: mockTx,
    _mockUpdate: mockUpdate,
    _mockSet: mockSet,
    _mockWhere: mockWhere,
    _mockInsert: mockInsert,
    _mockValues: mockValues,
    ...overrides,
  };

  return mockDb;
}

describe('CreditService', () => {
  const userId = 'user-test-123';
  let db: ReturnType<typeof makeDb>;
  let service: CreditService;

  beforeEach(() => {
    vi.clearAllMocks();
    db = makeDb();
    service = new CreditService(db as any, userId);
  });

  // ---------------------------------------------------------------------------
  // calculateCost
  // ---------------------------------------------------------------------------
  describe('calculateCost', () => {
    it('returns 0 when user is using own API config', async () => {
      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);
      expect(cost).toBe(0);
      expect(db.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('returns 0 when no pricing record exists for the model/provider', async () => {
      db.query.modelPricings.findFirst.mockResolvedValue(null);
      const cost = await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);
      expect(cost).toBe(0);
    });

    it('calculates cost correctly with input and output token pricing', async () => {
      db.query.modelPricings.findFirst.mockResolvedValue({
        model: 'deepseek-chat',
        provider: 'protochat',
        subProvider: null,
        userInputPrice: '2.0',   // 2 credits per 1M input tokens
        userOutputPrice: '4.0',  // 4 credits per 1M output tokens
        perRequestPrice: '0',
      });

      // 500,000 input + 200,000 output → (0.5 * 2) + (0.2 * 4) = 1.0 + 0.8 = 1.8
      const cost = await service.calculateCost('deepseek-chat', 'protochat', 500_000, 200_000);
      expect(cost).toBeCloseTo(1.8);
    });

    it('includes perRequestPrice in total cost', async () => {
      db.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4o',
        provider: 'openai',
        subProvider: null,
        userInputPrice: '0',
        userOutputPrice: '0',
        perRequestPrice: '0.5',
      });

      const cost = await service.calculateCost('gpt-4o', 'openai', 0, 0);
      expect(cost).toBeCloseTo(0.5);
    });

    it('handles missing price fields as 0', async () => {
      db.query.modelPricings.findFirst.mockResolvedValue({
        model: 'model-x',
        provider: 'provider-x',
        subProvider: null,
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
      });

      const cost = await service.calculateCost('model-x', 'provider-x', 1_000_000, 1_000_000);
      expect(cost).toBe(0);
    });

    it('defaults isUserConfig to false and charges normally', async () => {
      db.query.modelPricings.findFirst.mockResolvedValue({
        userInputPrice: '1.0',
        userOutputPrice: '2.0',
        perRequestPrice: '0',
        subProvider: 'sub',
      });

      const cost = await service.calculateCost('model', 'provider', 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(3.0); // 1 + 2
    });
  });

  // ---------------------------------------------------------------------------
  // deductCredits
  // ---------------------------------------------------------------------------
  describe('deductCredits', () => {
    it('does nothing when amount is 0', async () => {
      await service.deductCredits(0, 'test');
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('does nothing when amount is negative', async () => {
      await service.deductCredits(-5, 'test');
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('throws when user balance record does not exist', async () => {
      db._mockTx.query.userBalances.findFirst.mockResolvedValue(null);

      await expect(service.deductCredits(10, 'description')).rejects.toThrow('User balance not found');
    });

    it('throws when user has insufficient credits', async () => {
      db._mockTx.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '5.0000',
        isUnlimited: false,
      });

      await expect(service.deductCredits(10, 'description')).rejects.toThrow('Insufficient credits');
    });

    it('deducts credits and inserts transaction for a user with enough balance', async () => {
      db._mockTx.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '100.0000',
        isUnlimited: false,
      });

      const result = await service.deductCredits(30, 'model usage', 'msg-ref', { model: 'gpt-4' });

      expect(db._mockUpdate).toHaveBeenCalled();
      expect(db._mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ balance: '70.0000' }),
      );
      expect(db._mockInsert).toHaveBeenCalled();
      expect(db._mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '-30.0000',
          balanceAfter: '70.0000',
          category: 'CONSUMPTION',
          description: 'model usage',
          refId: 'msg-ref',
          type: 'CONSUMPTION',
          userId,
        }),
      );
      expect(result).toBeCloseTo(70);
    });

    it('allows deduction when user has unlimited credits even with low balance', async () => {
      db._mockTx.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: true,
      });

      await expect(service.deductCredits(999, 'big usage')).resolves.not.toThrow();
      expect(db._mockInsert).toHaveBeenCalled();
    });

    it('passes optional metadata to the transaction record', async () => {
      db._mockTx.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '50.0000',
        isUnlimited: false,
      });

      await service.deductCredits(5, 'with metadata', undefined, { extra: 'data' });

      expect(db._mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { extra: 'data' } }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // hasEnoughCredits
  // ---------------------------------------------------------------------------
  describe('hasEnoughCredits', () => {
    it('returns false when the user has no balance record', async () => {
      db.query.userBalances.findFirst.mockResolvedValue(null);
      const result = await service.hasEnoughCredits();
      expect(result).toBe(false);
    });

    it('returns true when user has unlimited credits', async () => {
      db.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: true,
      });
      const result = await service.hasEnoughCredits(9999);
      expect(result).toBe(true);
    });

    it('returns true when estimatedAmount is 0 and balance is positive', async () => {
      db.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '10.0000',
        isUnlimited: false,
      });
      const result = await service.hasEnoughCredits(0);
      expect(result).toBe(true);
    });

    it('returns false when estimatedAmount is 0 and balance is zero', async () => {
      db.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: false,
      });
      const result = await service.hasEnoughCredits(0);
      expect(result).toBe(false);
    });

    it('returns true when balance equals estimated amount', async () => {
      db.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '5.0000',
        isUnlimited: false,
      });
      const result = await service.hasEnoughCredits(5);
      expect(result).toBe(true);
    });

    it('returns false when balance is less than estimated amount', async () => {
      db.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '4.9999',
        isUnlimited: false,
      });
      const result = await service.hasEnoughCredits(5);
      expect(result).toBe(false);
    });

    it('returns true when balance exceeds estimated amount', async () => {
      db.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '100.0000',
        isUnlimited: false,
      });
      const result = await service.hasEnoughCredits(50);
      expect(result).toBe(true);
    });
  });
});
