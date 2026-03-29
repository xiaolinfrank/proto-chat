import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';

import { CreditService } from './index';

// Mock idGenerator
vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn((prefix: string) => `${prefix}_mock_id`),
}));

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: Partial<LobeChatDatabase>;
  const userId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      query: {
        modelPricings: { findFirst: vi.fn() },
        userBalances: { findFirst: vi.fn() },
        userTransactions: { findFirst: vi.fn() },
      } as any,
      transaction: vi.fn(),
    };
    service = new CreditService(mockDb as LobeChatDatabase, userId);
  });

  // ---------------------------------------------------------------------------
  describe('calculateCost', () => {
    it('should return 0 when user is using their own API key', async () => {
      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);
      expect(cost).toBe(0);
      expect(mockDb.query!.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing found for the model', async () => {
      vi.mocked(mockDb.query!.modelPricings.findFirst).mockResolvedValue(undefined);

      const cost = await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);
      expect(cost).toBe(0);
    });

    it('should calculate cost correctly using user pricing', async () => {
      vi.mocked(mockDb.query!.modelPricings.findFirst).mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10', // 10 credits per 1M tokens
        userOutputPrice: '30', // 30 credits per 1M tokens
        perRequestPrice: '0',
        subProvider: null,
      } as any);

      // 1,000,000 input tokens + 1,000,000 output tokens
      const cost = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);
      expect(cost).toBe(40); // 10 + 30
    });

    it('should include perRequestPrice in cost', async () => {
      vi.mocked(mockDb.query!.modelPricings.findFirst).mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '0',
        userOutputPrice: '0',
        perRequestPrice: '5',
        subProvider: null,
      } as any);

      const cost = await service.calculateCost('gpt-4', 'openai', 100, 100);
      expect(cost).toBe(5);
    });

    it('should handle null/undefined price fields as 0', async () => {
      vi.mocked(mockDb.query!.modelPricings.findFirst).mockResolvedValue({
        model: 'some-model',
        provider: 'some-provider',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
        subProvider: null,
      } as any);

      const cost = await service.calculateCost('some-model', 'some-provider', 1000, 500);
      expect(cost).toBe(0);
    });

    it('should scale cost proportionally with token count', async () => {
      vi.mocked(mockDb.query!.modelPricings.findFirst).mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10',
        userOutputPrice: '20',
        perRequestPrice: '0',
        subProvider: null,
      } as any);

      const cost500k = await service.calculateCost('gpt-4', 'openai', 500_000, 0);
      expect(cost500k).toBeCloseTo(5); // 0.5 * 10

      const cost2M = await service.calculateCost('gpt-4', 'openai', 2_000_000, 0);
      expect(cost2M).toBeCloseTo(20); // 2 * 10
    });

    it('should default isUserConfig to false', async () => {
      vi.mocked(mockDb.query!.modelPricings.findFirst).mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10',
        userOutputPrice: '20',
        perRequestPrice: '0',
        subProvider: null,
      } as any);

      await service.calculateCost('gpt-4', 'openai', 1_000_000, 0);
      expect(mockDb.query!.modelPricings.findFirst).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  describe('deductCredits', () => {
    it('should do nothing when amount is 0', async () => {
      await service.deductCredits(0, 'test');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should do nothing when amount is negative', async () => {
      await service.deductCredits(-1, 'negative');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw when user balance record is not found', async () => {
      vi.mocked(mockDb.transaction!).mockImplementation(async (fn: any) => {
        const tx = {
          query: { userBalances: { findFirst: vi.fn().mockResolvedValue(null) } },
        };
        return fn(tx);
      });

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('User balance not found');
    });

    it('should throw when user has insufficient credits', async () => {
      vi.mocked(mockDb.transaction!).mockImplementation(async (fn: any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({ balance: '5.0000', isUnlimited: false }),
            },
          },
        };
        return fn(tx);
      });

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('Insufficient credits');
    });

    it('should deduct credits and insert transaction record for regular user', async () => {
      const mockUpdate = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) };
      const mockInsert = { values: vi.fn().mockResolvedValue(undefined) };

      vi.mocked(mockDb.transaction!).mockImplementation(async (fn: any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({ balance: '100.0000', isUnlimited: false }),
            },
          },
          update: vi.fn().mockReturnValue(mockUpdate),
          insert: vi.fn().mockReturnValue(mockInsert),
        };
        return fn(tx);
      });

      const newBalance = await service.deductCredits(30, 'chat completion', 'ref-123');
      expect(newBalance).toBeCloseTo(70);
    });

    it('should allow deduction even with insufficient credits for unlimited users', async () => {
      const mockUpdate = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) };
      const mockInsert = { values: vi.fn().mockResolvedValue(undefined) };

      vi.mocked(mockDb.transaction!).mockImplementation(async (fn: any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({ balance: '0.0000', isUnlimited: true }),
            },
          },
          update: vi.fn().mockReturnValue(mockUpdate),
          insert: vi.fn().mockReturnValue(mockInsert),
        };
        return fn(tx);
      });

      // Unlimited user with 0 balance should not throw
      const newBalance = await service.deductCredits(999, 'test');
      expect(typeof newBalance).toBe('number');
    });
  });

  // ---------------------------------------------------------------------------
  describe('hasEnoughCredits', () => {
    it('should return false when balance record is not found', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue(undefined);

      const result = await service.hasEnoughCredits();
      expect(result).toBe(false);
    });

    it('should return true for unlimited users regardless of balance', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue({
        balance: '0.0000',
        isUnlimited: true,
      } as any);

      expect(await service.hasEnoughCredits(1000)).toBe(true);
    });

    it('should return true when balance > 0 and no estimatedAmount given', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue({
        balance: '1.0000',
        isUnlimited: false,
      } as any);

      expect(await service.hasEnoughCredits()).toBe(true);
    });

    it('should return false when balance is 0 and no estimatedAmount given', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue({
        balance: '0.0000',
        isUnlimited: false,
      } as any);

      expect(await service.hasEnoughCredits()).toBe(false);
    });

    it('should return true when balance >= estimatedAmount', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue({
        balance: '50.0000',
        isUnlimited: false,
      } as any);

      expect(await service.hasEnoughCredits(50)).toBe(true);
    });

    it('should return false when balance < estimatedAmount', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue({
        balance: '10.0000',
        isUnlimited: false,
      } as any);

      expect(await service.hasEnoughCredits(50)).toBe(false);
    });
  });
});
