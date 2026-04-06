import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';

import { CreditService } from './index';

// Mock idGenerator to return a predictable value
vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn(() => 'tx_mock_id'),
}));

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: any;
  const userId = 'test-user-id';

  beforeEach(() => {
    mockDb = {
      query: {
        modelPricings: { findFirst: vi.fn() },
        userBalances: { findFirst: vi.fn() },
      } as any,
      transaction: vi.fn(),
    };

    service = new CreditService(mockDb, userId);
  });

  // ─── calculateCost ────────────────────────────────────────────────────────

  describe('calculateCost', () => {
    it('should return 0 when user is using their own config', async () => {
      const result = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);

      expect(result).toBe(0);
      expect(mockDb.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing is found for the model', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(undefined);

      const result = await service.calculateCost('unknown-model', 'openai', 1000, 500);

      expect(result).toBe(0);
    });

    it('should calculate cost correctly using userInputPrice and userOutputPrice', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10', // 10 credits per 1M tokens
        userOutputPrice: '30', // 30 credits per 1M tokens
        perRequestPrice: '0',
        subProvider: null,
      });

      // 1M input + 1M output → 10 + 30 = 40 credits
      const result = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);

      expect(result).toBe(40);
    });

    it('should include perRequestPrice in cost calculation', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '0',
        userOutputPrice: '0',
        perRequestPrice: '5',
        subProvider: null,
      });

      const result = await service.calculateCost('gpt-4', 'openai', 0, 0);

      expect(result).toBe(5);
    });

    it('should handle partial token counts correctly', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue({
        model: 'claude-3',
        provider: 'anthropic',
        userInputPrice: '8',
        userOutputPrice: '24',
        perRequestPrice: '0',
        subProvider: null,
      });

      // 500k input + 250k output → (0.5 * 8) + (0.25 * 24) = 4 + 6 = 10
      const result = await service.calculateCost('claude-3', 'anthropic', 500_000, 250_000);

      expect(result).toBeCloseTo(10, 5);
    });

    it('should treat null/undefined pricing fields as 0', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue({
        model: 'model-a',
        provider: 'provider-x',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
        subProvider: null,
      });

      const result = await service.calculateCost('model-a', 'provider-x', 1_000_000, 1_000_000);

      expect(result).toBe(0);
    });

    it('should query using the exact model and provider', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(null);

      await service.calculateCost('deepseek/deepseek-chat-v3.1', 'protochat', 100, 100);

      expect(mockDb.query.modelPricings.findFirst).toHaveBeenCalledOnce();
    });

    it('should default isUserConfig to false and charge normally', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10',
        userOutputPrice: '10',
        perRequestPrice: '0',
        subProvider: null,
      });

      const result = await service.calculateCost('gpt-4', 'openai', 1_000_000, 0);

      expect(result).toBe(10);
    });
  });

  // ─── deductCredits ────────────────────────────────────────────────────────

  describe('deductCredits', () => {
    it('should return early without DB call when amount is 0', async () => {
      await service.deductCredits(0, 'test');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should return early without DB call when amount is negative', async () => {
      await service.deductCredits(-5, 'refund');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw when user balance record is not found', async () => {
      vi.mocked(mockDb.transaction).mockImplementation(async (cb: any) => {
        const tx = {
          query: { userBalances: { findFirst: vi.fn().mockResolvedValue(null) } },
        };
        return cb(tx);
      });

      await expect(service.deductCredits(10, 'chat')).rejects.toThrow('User balance not found');
    });

    it('should throw when user has insufficient credits', async () => {
      vi.mocked(mockDb.transaction).mockImplementation(async (cb: any) => {
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
        };
        return cb(tx);
      });

      await expect(service.deductCredits(10, 'chat')).rejects.toThrow('Insufficient credits');
    });

    it('should deduct credits and insert transaction when balance is sufficient', async () => {
      const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) });
      const mockInsert = vi.fn().mockReturnValue({ values: vi.fn() });

      vi.mocked(mockDb.transaction).mockImplementation(async (cb: any) => {
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
          insert: mockInsert,
        };
        return cb(tx);
      });

      const newBalance = await service.deductCredits(25, 'test deduction', 'ref-123');

      expect(newBalance).toBe(75);
    });

    it('should allow deduction when user has unlimited balance regardless of amount', async () => {
      const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) });
      const mockInsert = vi.fn().mockReturnValue({ values: vi.fn() });

      vi.mocked(mockDb.transaction).mockImplementation(async (cb: any) => {
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
          update: mockUpdate,
          insert: mockInsert,
        };
        return cb(tx);
      });

      // Should not throw despite balance being 0
      const newBalance = await service.deductCredits(999, 'unlimited user');

      expect(newBalance).toBe(-999);
    });

    it('should format newBalance with 4 decimal places', async () => {
      let capturedSetArgs: any;
      const mockSet = vi.fn((args) => {
        capturedSetArgs = args;
        return { where: vi.fn() };
      });
      const mockInsert = vi.fn().mockReturnValue({ values: vi.fn() });

      vi.mocked(mockDb.transaction).mockImplementation(async (cb: any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId,
                balance: '10.0000',
                isUnlimited: false,
              }),
            },
          },
          update: vi.fn().mockReturnValue({ set: mockSet }),
          insert: mockInsert,
        };
        return cb(tx);
      });

      await service.deductCredits(3.333, 'partial');

      expect(capturedSetArgs.balance).toBe('6.6670');
    });
  });

  // ─── hasEnoughCredits ────────────────────────────────────────────────────

  describe('hasEnoughCredits', () => {
    it('should return false when user balance record is not found', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(null);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true for unlimited users regardless of balance', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: true,
      });

      const result = await service.hasEnoughCredits(1000);

      expect(result).toBe(true);
    });

    it('should return true when balance is positive and no estimated amount provided', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '5.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits();

      expect(result).toBe(true);
    });

    it('should return false when balance is zero and no estimated amount provided', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when balance exactly equals estimated amount', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '10.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(10);

      expect(result).toBe(true);
    });

    it('should return false when balance is less than estimated amount', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '9.9999',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(10);

      expect(result).toBe(false);
    });

    it('should return true when balance exceeds estimated amount', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '100.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should return false when balance is negative', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '-1.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });
  });
});
