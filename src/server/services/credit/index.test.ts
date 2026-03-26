import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';

import { CreditService } from './index';

vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn().mockReturnValue('mock-tx-id'),
}));

const makePricing = (overrides: Record<string, unknown> = {}) =>
  ({
    model: 'gpt-4',
    provider: 'openai',
    userInputPrice: '10.0',
    userOutputPrice: '30.0',
    perRequestPrice: '0',
    subProvider: null,
    ...overrides,
  }) as any;

const makeBalance = (overrides: Record<string, unknown> = {}) =>
  ({
    userId: 'test-user-id',
    balance: '100.0000',
    isUnlimited: false,
    totalPurchased: '100.0000',
    createdAt: new Date(),
    updatedAt: new Date(),
    accessedAt: new Date(),
    ...overrides,
  }) as any;

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: LobeChatDatabase;
  const userId = 'test-user-id';

  beforeEach(() => {
    mockDb = {
      query: {
        modelPricings: { findFirst: vi.fn() },
        userBalances: { findFirst: vi.fn() },
      },
      transaction: vi.fn(),
    } as unknown as LobeChatDatabase;

    service = new CreditService(mockDb, userId);
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using their own API key', async () => {
      const result = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);

      expect(result).toBe(0);
      expect(mockDb.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing is found for the model', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(undefined);

      const result = await service.calculateCost('unknown-model', 'openai', 1000, 500);

      expect(result).toBe(0);
    });

    it('should calculate cost correctly based on input and output tokens', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(
        makePricing({ userInputPrice: '10.0', userOutputPrice: '30.0', perRequestPrice: '0' }),
      );

      // 1M input + 1M output => 10 + 30 = 40
      const result = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);

      expect(result).toBe(40);
    });

    it('should include perRequestPrice in cost calculation', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(
        makePricing({ userInputPrice: '10.0', userOutputPrice: '30.0', perRequestPrice: '0.5' }),
      );

      const result = await service.calculateCost('gpt-4', 'openai', 0, 0);

      expect(result).toBe(0.5);
    });

    it('should handle missing price fields gracefully (treat as 0)', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(
        makePricing({
          model: 'free-model',
          userInputPrice: undefined,
          userOutputPrice: undefined,
          perRequestPrice: undefined,
        }),
      );

      const result = await service.calculateCost('free-model', 'openai', 1_000_000, 1_000_000);

      expect(result).toBe(0);
    });

    it('should scale cost proportionally with token count', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(
        makePricing({ userInputPrice: '10.0', userOutputPrice: '20.0', perRequestPrice: '0' }),
      );

      // 500K input = 5, 250K output = 5, total = 10
      const result = await service.calculateCost('gpt-4', 'openai', 500_000, 250_000);

      expect(result).toBeCloseTo(10, 5);
    });

    it('should default isUserConfig to false and query DB when not provided', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(undefined);

      await service.calculateCost('gpt-4', 'openai', 100, 50);

      expect(mockDb.query.modelPricings.findFirst).toHaveBeenCalled();
    });
  });

  describe('deductCredits', () => {
    const setupTransactionMock = (balance: any) => {
      const mockTx = {
        query: {
          userBalances: { findFirst: vi.fn().mockResolvedValue(balance) },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      };

      vi.mocked(mockDb.transaction).mockImplementation(async (fn: any) => fn(mockTx));

      return mockTx;
    };

    it('should do nothing when amount is 0', async () => {
      await service.deductCredits(0, 'test');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should do nothing when amount is negative', async () => {
      await service.deductCredits(-5, 'test');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw when user balance is not found', async () => {
      setupTransactionMock(null);

      await expect(service.deductCredits(10, 'test charge')).rejects.toThrow(
        'User balance not found',
      );
    });

    it('should throw when user has insufficient credits', async () => {
      setupTransactionMock(makeBalance({ balance: '5.0000', isUnlimited: false }));

      await expect(service.deductCredits(10, 'test charge')).rejects.toThrow(
        'Insufficient credits',
      );
    });

    it('should deduct credits from balance and create transaction record', async () => {
      const mockTx = setupTransactionMock(makeBalance({ balance: '100.0000', isUnlimited: false }));

      const result = await service.deductCredits(25.5, 'AI usage', 'ref-123', { model: 'gpt-4' });

      // Balance updated
      expect(mockTx.update).toHaveBeenCalled();
      const setCall = mockTx.update().set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({ balance: '74.5000' }),
      );

      // Transaction inserted
      expect(mockTx.insert).toHaveBeenCalled();
      const valuesCall = mockTx.insert().values;
      expect(valuesCall).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '-25.5000',
          balanceAfter: '74.5000',
          category: 'CONSUMPTION',
          description: 'AI usage',
          refId: 'ref-123',
          metadata: { model: 'gpt-4' },
          userId,
        }),
      );

      expect(result).toBe(74.5);
    });

    it('should allow deduction when user has unlimited credits regardless of balance', async () => {
      const mockTx = setupTransactionMock(makeBalance({ balance: '0.0000', isUnlimited: true }));

      await expect(service.deductCredits(50, 'AI usage')).resolves.not.toThrow();
      expect(mockTx.update).toHaveBeenCalled();
    });

    it('should deduct exact amount when balance equals amount', async () => {
      const mockTx = setupTransactionMock(makeBalance({ balance: '10.0000', isUnlimited: false }));

      const result = await service.deductCredits(10, 'exact deduction');

      const setCall = mockTx.update().set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({ balance: '0.0000' }),
      );
      expect(result).toBe(0);
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when user balance record does not exist', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(undefined);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when user has unlimited credits', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(
        makeBalance({ isUnlimited: true, balance: '0' }),
      );

      const result = await service.hasEnoughCredits(1000);

      expect(result).toBe(true);
    });

    it('should return true when balance is positive and no estimatedAmount provided', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(
        makeBalance({ isUnlimited: false, balance: '5.5' }),
      );

      const result = await service.hasEnoughCredits();

      expect(result).toBe(true);
    });

    it('should return false when balance is 0 and no estimatedAmount provided', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(
        makeBalance({ isUnlimited: false, balance: '0' }),
      );

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when balance meets or exceeds estimatedAmount', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(
        makeBalance({ isUnlimited: false, balance: '10.0' }),
      );

      expect(await service.hasEnoughCredits(10)).toBe(true);
      expect(await service.hasEnoughCredits(9.9999)).toBe(true);
    });

    it('should return false when balance is less than estimatedAmount', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(
        makeBalance({ isUnlimited: false, balance: '5.0' }),
      );

      const result = await service.hasEnoughCredits(10);

      expect(result).toBe(false);
    });

    it('should return false when balance is 0 with a positive estimatedAmount', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(
        makeBalance({ isUnlimited: false, balance: '0' }),
      );

      const result = await service.hasEnoughCredits(0.0001);

      expect(result).toBe(false);
    });
  });
});
