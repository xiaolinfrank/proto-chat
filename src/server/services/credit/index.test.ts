import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';

import { CreditService } from './index';

const userId = 'test-user-id';

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: Partial<LobeChatDatabase>;

  beforeEach(() => {
    mockDb = {
      query: {
        modelPricings: { findFirst: vi.fn() },
        userBalances: { findFirst: vi.fn() },
      } as any,
      transaction: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      insert: vi.fn(),
    };

    service = new CreditService(mockDb as LobeChatDatabase, userId);
    vi.clearAllMocks();
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using their own API key', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);

      expect(result).toBe(0);
      expect(mockDb.query!.modelPricings.findFirst).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should return 0 when no pricing is found for model', async () => {
      vi.mocked(mockDb.query!.modelPricings.findFirst).mockResolvedValue(undefined);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await service.calculateCost('unknown-model', 'openai', 1000, 500);

      expect(result).toBe(0);
      warnSpy.mockRestore();
    });

    it('should calculate cost based on input and output tokens', async () => {
      vi.mocked(mockDb.query!.modelPricings.findFirst).mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '5',
        userOutputPrice: '15',
        perRequestPrice: '0',
        subProvider: null,
      } as any);
      vi.spyOn(console, 'log').mockImplementation(() => {});

      // 1,000,000 tokens at $5/M input and $15/M output
      const result = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);

      expect(result).toBe(20); // 5 + 15
    });

    it('should include perRequestPrice in cost calculation', async () => {
      vi.mocked(mockDb.query!.modelPricings.findFirst).mockResolvedValue({
        model: 'claude-3-sonnet',
        provider: 'anthropic',
        userInputPrice: '3',
        userOutputPrice: '15',
        perRequestPrice: '0.001',
        subProvider: null,
      } as any);
      vi.spyOn(console, 'log').mockImplementation(() => {});

      // 0 tokens, only per-request price
      const result = await service.calculateCost('claude-3-sonnet', 'anthropic', 0, 0);

      expect(result).toBeCloseTo(0.001);
    });

    it('should handle fractional token counts correctly', async () => {
      vi.mocked(mockDb.query!.modelPricings.findFirst).mockResolvedValue({
        model: 'gpt-3.5',
        provider: 'openai',
        userInputPrice: '0.5',
        userOutputPrice: '1.5',
        perRequestPrice: '0',
        subProvider: null,
      } as any);
      vi.spyOn(console, 'log').mockImplementation(() => {});

      // 100,000 input tokens and 50,000 output tokens
      const result = await service.calculateCost('gpt-3.5', 'openai', 100_000, 50_000);

      const expectedCost = (100_000 / 1_000_000) * 0.5 + (50_000 / 1_000_000) * 1.5;
      expect(result).toBeCloseTo(expectedCost);
    });

    it('should log sub-provider info when pricing has subProvider', async () => {
      vi.mocked(mockDb.query!.modelPricings.findFirst).mockResolvedValue({
        model: 'deepseek-chat',
        provider: 'protochat',
        userInputPrice: '1',
        userOutputPrice: '2',
        perRequestPrice: '0',
        subProvider: 'deepseek',
      } as any);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await service.calculateCost('deepseek-chat', 'protochat', 500_000, 500_000);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('via deepseek'));
      logSpy.mockRestore();
    });

    it('should return 0 when isUserConfig defaults to false but no pricing found', async () => {
      vi.mocked(mockDb.query!.modelPricings.findFirst).mockResolvedValue(undefined as any);
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await service.calculateCost('any-model', 'any-provider', 100, 100);

      expect(result).toBe(0);
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when no balance record found', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue(undefined);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when balance is unlimited', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '0',
        isUnlimited: true,
      } as any);

      const result = await service.hasEnoughCredits(100);

      expect(result).toBe(true);
    });

    it('should return true when estimatedAmount is 0 and balance is positive', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '10.5',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(true);
    });

    it('should return false when estimatedAmount is 0 and balance is zero', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '0',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(false);
    });

    it('should return false when estimatedAmount is 0 and balance is negative', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '-5',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(false);
    });

    it('should return true when balance >= estimatedAmount', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '50.0',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should return false when balance < estimatedAmount', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '10.0',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits(20);

      expect(result).toBe(false);
    });

    it('should use default estimatedAmount of 0 when called with no arguments', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '5.0',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(true);
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

    it('should throw error when user balance not found', async () => {
      vi.mocked(mockDb.transaction as any).mockImplementation(async (fn: any) => {
        const mockTx = {
          query: { userBalances: { findFirst: vi.fn().mockResolvedValue(null) } },
        };
        return fn(mockTx);
      });

      await expect(service.deductCredits(10, 'test description')).rejects.toThrow(
        'User balance not found',
      );
    });

    it('should throw error when balance is insufficient (not unlimited)', async () => {
      vi.mocked(mockDb.transaction as any).mockImplementation(async (fn: any) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId,
                balance: '5.0',
                isUnlimited: false,
              }),
            },
          },
        };
        return fn(mockTx);
      });

      await expect(service.deductCredits(10, 'test description')).rejects.toThrow(
        'Insufficient credits',
      );
    });

    it('should successfully deduct credits when balance is sufficient', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      vi.mocked(mockDb.transaction as any).mockImplementation(async (fn: any) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId,
                balance: '100.0',
                isUnlimited: false,
              }),
            },
          },
          update: mockUpdate,
          insert: mockInsert,
        };
        return fn(mockTx);
      });
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await service.deductCredits(30, 'chat usage', 'msg-123');

      expect(result).toBeCloseTo(70);
    });

    it('should allow unlimited balance users to deduct any amount', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      vi.mocked(mockDb.transaction as any).mockImplementation(async (fn: any) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId,
                balance: '0',
                isUnlimited: true,
              }),
            },
          },
          update: mockUpdate,
          insert: mockInsert,
        };
        return fn(mockTx);
      });

      // Should not throw even though balance is 0 but isUnlimited is true
      await expect(service.deductCredits(999, 'unlimited user usage')).resolves.not.toThrow();
    });
  });
});
