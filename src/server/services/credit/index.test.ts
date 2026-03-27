import { describe, expect, it, vi, beforeEach } from 'vitest';

import { CreditService } from '.';

vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn(() => 'tx_mock_id'),
}));

const makeMockDb = ({
  modelPricing = null as any,
  userBalance = null as any,
} = {}) => {
  const mockTx = {
    query: {
      userBalances: {
        findFirst: vi.fn().mockResolvedValue(userBalance),
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

  return {
    query: {
      modelPricings: {
        findFirst: vi.fn().mockResolvedValue(modelPricing),
      },
      userBalances: {
        findFirst: vi.fn().mockResolvedValue(userBalance),
      },
    },
    transaction: vi.fn().mockImplementation((fn: (tx: any) => any) => fn(mockTx)),
    _mockTx: mockTx,
  } as any;
};

describe('CreditService', () => {
  describe('calculateCost', () => {
    it('should return 0 when user is using own API key', async () => {
      const db = makeMockDb();
      const service = new CreditService(db, 'user1');

      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);

      expect(cost).toBe(0);
      expect(db.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing found for the model', async () => {
      const db = makeMockDb({ modelPricing: null });
      const service = new CreditService(db, 'user1');

      const cost = await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);

      expect(cost).toBe(0);
    });

    it('should calculate cost correctly with input and output tokens', async () => {
      const db = makeMockDb({
        modelPricing: {
          userInputPrice: '2.0',
          userOutputPrice: '4.0',
          perRequestPrice: '0',
          subProvider: null,
        },
      });
      const service = new CreditService(db, 'user1');

      // 1M input tokens @ 2.0 + 1M output tokens @ 4.0 = 6.0
      const cost = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);

      expect(cost).toBeCloseTo(6.0);
    });

    it('should include per-request price in calculation', async () => {
      const db = makeMockDb({
        modelPricing: {
          userInputPrice: '0',
          userOutputPrice: '0',
          perRequestPrice: '0.01',
          subProvider: null,
        },
      });
      const service = new CreditService(db, 'user1');

      const cost = await service.calculateCost('model', 'provider', 100, 100);

      expect(cost).toBeCloseTo(0.01);
    });

    it('should handle fractional token counts correctly', async () => {
      const db = makeMockDb({
        modelPricing: {
          userInputPrice: '1.0',
          userOutputPrice: '2.0',
          perRequestPrice: '0',
          subProvider: null,
        },
      });
      const service = new CreditService(db, 'user1');

      // 500k input @ 1.0/1M = 0.5, 250k output @ 2.0/1M = 0.5
      const cost = await service.calculateCost('model', 'provider', 500_000, 250_000);

      expect(cost).toBeCloseTo(1.0);
    });

    it('should treat missing prices as 0', async () => {
      const db = makeMockDb({
        modelPricing: {
          userInputPrice: null,
          userOutputPrice: undefined,
          perRequestPrice: null,
          subProvider: null,
        },
      });
      const service = new CreditService(db, 'user1');

      const cost = await service.calculateCost('model', 'provider', 1_000_000, 1_000_000);

      expect(cost).toBe(0);
    });

    it('should default isUserConfig to false', async () => {
      const db = makeMockDb({
        modelPricing: {
          userInputPrice: '1.0',
          userOutputPrice: '1.0',
          perRequestPrice: '0',
          subProvider: null,
        },
      });
      const service = new CreditService(db, 'user1');

      const cost = await service.calculateCost('model', 'provider', 1_000_000, 0);

      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('deductCredits', () => {
    it('should not deduct when amount is 0', async () => {
      const db = makeMockDb();
      const service = new CreditService(db, 'user1');

      await service.deductCredits(0, 'test');

      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('should not deduct when amount is negative', async () => {
      const db = makeMockDb();
      const service = new CreditService(db, 'user1');

      await service.deductCredits(-5, 'test');

      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('should throw when user balance not found', async () => {
      const db = makeMockDb({ userBalance: null });
      const service = new CreditService(db, 'user1');

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('User balance not found');
    });

    it('should throw when user has insufficient credits', async () => {
      const db = makeMockDb({
        userBalance: { userId: 'user1', balance: '5.0000', isUnlimited: false },
      });
      const service = new CreditService(db, 'user1');

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('Insufficient credits');
    });

    it('should allow deduction for unlimited users even with low balance', async () => {
      const db = makeMockDb({
        userBalance: { userId: 'user1', balance: '0.0000', isUnlimited: true },
      });
      const service = new CreditService(db, 'user1');

      const result = await service.deductCredits(100, 'test');

      expect(db.transaction).toHaveBeenCalled();
      expect(result).toBeCloseTo(-100);
    });

    it('should deduct credits and return new balance', async () => {
      const db = makeMockDb({
        userBalance: { userId: 'user1', balance: '50.0000', isUnlimited: false },
      });
      const service = new CreditService(db, 'user1');

      const newBalance = await service.deductCredits(10, 'chat usage');

      expect(newBalance).toBeCloseTo(40);
    });

    it('should insert a transaction record on deduction', async () => {
      const db = makeMockDb({
        userBalance: { userId: 'user1', balance: '100.0000', isUnlimited: false },
      });
      const service = new CreditService(db, 'user1');

      await service.deductCredits(25, 'api call', 'ref-123', { model: 'gpt-4' });

      const tx = db._mockTx;
      expect(tx.insert).toHaveBeenCalled();
      const insertValues = tx.insert().values.mock.calls[0][0];
      expect(insertValues.amount).toBe((-25).toFixed(4));
      expect(insertValues.description).toBe('api call');
      expect(insertValues.refId).toBe('ref-123');
      expect(insertValues.metadata).toEqual({ model: 'gpt-4' });
      expect(insertValues.category).toBe('CONSUMPTION');
      expect(insertValues.type).toBe('CONSUMPTION');
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when balance record not found', async () => {
      const db = makeMockDb({ userBalance: null });
      const service = new CreditService(db, 'user1');

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true for unlimited users regardless of balance', async () => {
      const db = makeMockDb({
        userBalance: { userId: 'user1', balance: '0.0000', isUnlimited: true },
      });
      const service = new CreditService(db, 'user1');

      const result = await service.hasEnoughCredits(9999);

      expect(result).toBe(true);
    });

    it('should return true when balance is positive and no estimatedAmount given', async () => {
      const db = makeMockDb({
        userBalance: { userId: 'user1', balance: '1.0000', isUnlimited: false },
      });
      const service = new CreditService(db, 'user1');

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(true);
    });

    it('should return false when balance is zero and no estimatedAmount given', async () => {
      const db = makeMockDb({
        userBalance: { userId: 'user1', balance: '0.0000', isUnlimited: false },
      });
      const service = new CreditService(db, 'user1');

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(false);
    });

    it('should return true when balance meets or exceeds estimatedAmount', async () => {
      const db = makeMockDb({
        userBalance: { userId: 'user1', balance: '10.0000', isUnlimited: false },
      });
      const service = new CreditService(db, 'user1');

      expect(await service.hasEnoughCredits(10)).toBe(true);
      expect(await service.hasEnoughCredits(5)).toBe(true);
    });

    it('should return false when balance is less than estimatedAmount', async () => {
      const db = makeMockDb({
        userBalance: { userId: 'user1', balance: '5.0000', isUnlimited: false },
      });
      const service = new CreditService(db, 'user1');

      const result = await service.hasEnoughCredits(10);

      expect(result).toBe(false);
    });

    it('should default estimatedAmount to 0', async () => {
      const db = makeMockDb({
        userBalance: { userId: 'user1', balance: '1.0000', isUnlimited: false },
      });
      const service = new CreditService(db, 'user1');

      // calling with no args should work and return based on balance > 0
      const result = await service.hasEnoughCredits();

      expect(result).toBe(true);
    });
  });
});
