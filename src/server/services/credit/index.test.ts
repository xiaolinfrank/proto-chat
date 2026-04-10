import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';

import { CreditService } from './index';

// Mock the idGenerator used inside deductCredits
vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn(() => 'tx_mock_id'),
}));

// Mock the schema imports (drizzle table objects used as query identifiers)
vi.mock('@/database/schemas', () => ({
  modelPricings: { model: 'model', provider: 'provider' },
  userBalances: { userId: 'userId' },
  userTransactions: {},
}));

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
    vi.clearAllMocks();
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using their own API config', async () => {
      const result = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);

      expect(result).toBe(0);
      // Should not query the database at all
      expect(mockDb.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing is found for the model', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(undefined);

      const result = await service.calculateCost('unknown-model', 'openai', 1000, 500, false);

      expect(result).toBe(0);
    });

    it('should calculate cost correctly based on token usage', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10',   // 10 credits per 1M tokens
        userOutputPrice: '30',  // 30 credits per 1M tokens
        perRequestPrice: '0',
        subProvider: null,
      } as any);

      // 1,000,000 input tokens + 1,000,000 output tokens
      const result = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000, false);

      // cost = (1M / 1M) * 10 + (1M / 1M) * 30 + 0 = 40
      expect(result).toBeCloseTo(40, 4);
    });

    it('should include perRequestPrice in total cost', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue({
        model: 'some-model',
        provider: 'protochat',
        userInputPrice: '0',
        userOutputPrice: '0',
        perRequestPrice: '5',
        subProvider: null,
      } as any);

      const result = await service.calculateCost('some-model', 'protochat', 0, 0, false);

      expect(result).toBeCloseTo(5, 4);
    });

    it('should handle partial token counts correctly', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue({
        model: 'claude-3',
        provider: 'anthropic',
        userInputPrice: '3',   // 3 credits per 1M tokens
        userOutputPrice: '15', // 15 credits per 1M tokens
        perRequestPrice: '0',
        subProvider: null,
      } as any);

      // 500,000 input + 200,000 output tokens
      const result = await service.calculateCost('claude-3', 'anthropic', 500_000, 200_000, false);

      // cost = (0.5 * 3) + (0.2 * 15) = 1.5 + 3 = 4.5
      expect(result).toBeCloseTo(4.5, 4);
    });

    it('should default isUserConfig to false when not provided', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10',
        userOutputPrice: '30',
        perRequestPrice: '0',
        subProvider: null,
      } as any);

      const result = await service.calculateCost('gpt-4', 'openai', 1_000_000, 0);

      expect(result).toBeCloseTo(10, 4);
    });

    it('should handle missing price fields by treating them as 0', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue({
        model: 'model-x',
        provider: 'test',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
        subProvider: null,
      } as any);

      const result = await service.calculateCost('model-x', 'test', 1_000_000, 1_000_000, false);

      expect(result).toBe(0);
    });
  });

  describe('deductCredits', () => {
    it('should do nothing when amount is 0', async () => {
      await service.deductCredits(0, 'test charge');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should do nothing when amount is negative', async () => {
      await service.deductCredits(-5, 'test charge');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw when user balance is not found', async () => {
      vi.mocked(mockDb.transaction).mockImplementation(async (fn) => {
        const mockTx = {
          query: {
            userBalances: { findFirst: vi.fn().mockResolvedValue(null) },
          },
          update: vi.fn(),
          insert: vi.fn(),
        };
        return fn(mockTx as any);
      });

      await expect(service.deductCredits(10, 'test charge')).rejects.toThrow(
        'User balance not found',
      );
    });

    it('should throw when user has insufficient credits', async () => {
      vi.mocked(mockDb.transaction).mockImplementation(async (fn) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId,
                balance: '5.0000',
                isUnlimited: false,
              }),
            },
          },
          update: vi.fn(),
          insert: vi.fn(),
        };
        return fn(mockTx as any);
      });

      await expect(service.deductCredits(10, 'exceeds balance')).rejects.toThrow(
        'Insufficient credits',
      );
    });

    it('should deduct credits and create transaction record for normal user', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      });
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      vi.mocked(mockDb.transaction).mockImplementation(async (fn) => {
        const mockTx = {
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
          insert: mockInsert,
        };
        return fn(mockTx as any);
      });

      const result = await service.deductCredits(25, 'model usage', 'msg-123');

      // New balance should be 100 - 25 = 75
      expect(result).toBeCloseTo(75, 4);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should allow deduction even when balance would go to 0 for exact amount', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      });
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      vi.mocked(mockDb.transaction).mockImplementation(async (fn) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId,
                balance: '10.0000',
                isUnlimited: false,
              }),
            },
          },
          update: mockUpdate,
          insert: mockInsert,
        };
        return fn(mockTx as any);
      });

      const result = await service.deductCredits(10, 'exact amount');

      expect(result).toBeCloseTo(0, 4);
    });

    it('should allow deduction for unlimited users regardless of balance', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      });
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      vi.mocked(mockDb.transaction).mockImplementation(async (fn) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId,
                balance: '0.0000',
                isUnlimited: true,
              }),
            },
          },
          update: mockUpdate,
          insert: mockInsert,
        };
        return fn(mockTx as any);
      });

      // Unlimited users can go negative
      const result = await service.deductCredits(500, 'unlimited user charge');

      expect(result).toBeCloseTo(-500, 4);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when user balance record does not exist', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(undefined);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true for unlimited users regardless of balance', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: true,
      } as any);

      const result = await service.hasEnoughCredits(9999);

      expect(result).toBe(true);
    });

    it('should return true when estimatedAmount is 0 and balance is positive', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '0.0001',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(true);
    });

    it('should return false when estimatedAmount is 0 and balance is 0', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(false);
    });

    it('should return true when balance is greater than or equal to estimated amount', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '50.0000',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should return false when balance is less than estimated amount', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '49.9999',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(false);
    });

    it('should use default estimatedAmount of 0 when not provided', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '10.0000',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(true);
    });
  });
});
