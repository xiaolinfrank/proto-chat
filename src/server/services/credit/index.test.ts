import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';

import { CreditService } from './index';

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: LobeChatDatabase;
  const userId = 'test-user-id';

  beforeEach(() => {
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
    } as unknown as LobeChatDatabase;

    service = new CreditService(mockDb, userId);
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using own API key', async () => {
      const result = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);
      expect(result).toBe(0);
      expect(mockDb.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing found for model', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(undefined);

      const result = await service.calculateCost('unknown-model', 'openai', 1000, 500, false);
      expect(result).toBe(0);
    });

    it('should calculate cost correctly with input and output tokens', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.00', // credits per 1M tokens
        userOutputPrice: '30.00', // credits per 1M tokens
        perRequestPrice: '0',
        subProvider: null,
      } as any);

      // 1M input tokens * 10 credits/1M + 1M output tokens * 30 credits/1M = 40 credits
      const result = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000, false);
      expect(result).toBe(40);
    });

    it('should include perRequestPrice in cost calculation', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '0',
        userOutputPrice: '0',
        perRequestPrice: '5.00',
        subProvider: null,
      } as any);

      const result = await service.calculateCost('gpt-4', 'openai', 100, 100, false);
      expect(result).toBe(5);
    });

    it('should handle null pricing fields as 0', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
        subProvider: null,
      } as any);

      const result = await service.calculateCost('gpt-4', 'openai', 1000, 500, false);
      expect(result).toBe(0);
    });

    it('should use isUserConfig=false by default', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(undefined);

      const result = await service.calculateCost('gpt-4', 'openai', 1000, 500);
      // Should query db (returns 0 because no pricing found)
      expect(mockDb.query.modelPricings.findFirst).toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it('should calculate cost for small token counts correctly', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue({
        model: 'claude-3',
        provider: 'anthropic',
        userInputPrice: '3.00',
        userOutputPrice: '15.00',
        perRequestPrice: '0',
        subProvider: null,
      } as any);

      // 100 input tokens / 1M * 3 + 50 output tokens / 1M * 15
      const result = await service.calculateCost('claude-3', 'anthropic', 100, 50, false);
      const expected = (100 / 1_000_000) * 3 + (50 / 1_000_000) * 15;
      expect(result).toBeCloseTo(expected);
    });
  });

  describe('deductCredits', () => {
    it('should return early when amount is 0', async () => {
      await service.deductCredits(0, 'test description');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should return early when amount is negative', async () => {
      await service.deductCredits(-10, 'test description');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw error when user balance not found', async () => {
      vi.mocked(mockDb.transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(null),
            },
          },
        };
        return callback(mockTx);
      });

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('User balance not found');
    });

    it('should throw error when user has insufficient credits', async () => {
      vi.mocked(mockDb.transaction).mockImplementation(async (callback: any) => {
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
        };
        return callback(mockTx);
      });

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('Insufficient credits');
    });

    it('should deduct credits from user balance successfully', async () => {
      const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

      vi.mocked(mockDb.transaction).mockImplementation(async (callback: any) => {
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
        return callback(mockTx);
      });

      const result = await service.deductCredits(10, 'AI chat usage');
      expect(result).toBe(90);
    });

    it('should allow deduction when user has unlimited credits even if balance is low', async () => {
      const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
      const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

      vi.mocked(mockDb.transaction).mockImplementation(async (callback: any) => {
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
        return callback(mockTx);
      });

      // Should not throw for unlimited user even with 0 balance
      const result = await service.deductCredits(100, 'AI chat usage');
      expect(result).toBe(-100);
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when user balance not found', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(undefined);

      const result = await service.hasEnoughCredits();
      expect(result).toBe(false);
    });

    it('should return true when user has unlimited credits', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: true,
      } as any);

      const result = await service.hasEnoughCredits(1000);
      expect(result).toBe(true);
    });

    it('should return true when user has positive balance and no estimated amount', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '10.5000',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits(0);
      expect(result).toBe(true);
    });

    it('should return false when user has zero balance and no estimated amount', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits(0);
      expect(result).toBe(false);
    });

    it('should return true when balance is sufficient for estimated amount', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '50.0000',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits(25);
      expect(result).toBe(true);
    });

    it('should return false when balance is insufficient for estimated amount', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '10.0000',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits(50);
      expect(result).toBe(false);
    });

    it('should return true when balance exactly equals estimated amount', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '25.0000',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits(25);
      expect(result).toBe(true);
    });

    it('should use default estimatedAmount of 0', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '5.0000',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits();
      expect(result).toBe(true);
    });
  });
});
