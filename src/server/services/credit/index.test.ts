import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';

import { CreditService } from './index';

// Mock idGenerator
vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn().mockReturnValue('tx_mock_id'),
}));

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: any;
  const userId = 'test-user-id';

  beforeEach(() => {
    mockDb = {
      query: {
        userBalances: {
          findFirst: vi.fn(),
        },
        modelPricings: {
          findFirst: vi.fn(),
        },
      },
      transaction: vi.fn(),
      update: vi.fn(),
      insert: vi.fn(),
    } as unknown as LobeChatDatabase;

    service = new CreditService(mockDb as LobeChatDatabase, userId);
    vi.clearAllMocks();
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using own config', async () => {
      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);
      expect(cost).toBe(0);
      expect(mockDb.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing is found for the model', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(null);

      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500, false);
      expect(cost).toBe(0);
    });

    it('should calculate cost correctly based on input and output tokens', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '2.0',
        userOutputPrice: '6.0',
        perRequestPrice: '0',
        subProvider: null,
      });

      // 1,000,000 input tokens * $2 / 1M + 500,000 output tokens * $6 / 1M
      const cost = await service.calculateCost('gpt-4', 'openai', 1_000_000, 500_000);
      expect(cost).toBeCloseTo(2.0 + 3.0, 4); // 5.0 credits
    });

    it('should include per-request price in the cost', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'some-model',
        provider: 'openai',
        userInputPrice: '1.0',
        userOutputPrice: '2.0',
        perRequestPrice: '0.5',
        subProvider: null,
      });

      const cost = await service.calculateCost('some-model', 'openai', 0, 0);
      expect(cost).toBeCloseTo(0.5, 4);
    });

    it('should handle missing pricing fields as 0', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'free-model',
        provider: 'openai',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
        subProvider: null,
      });

      const cost = await service.calculateCost('free-model', 'openai', 1000, 1000);
      expect(cost).toBe(0);
    });

    it('should query pricing with correct model and provider', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(null);

      await service.calculateCost('deepseek/deepseek-chat-v3.1', 'protochat', 500, 300);

      expect(mockDb.query.modelPricings.findFirst).toHaveBeenCalledOnce();
    });

    it('should return 0 by default when isUserConfig is not provided', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(null);

      const cost = await service.calculateCost('gpt-4o', 'openai', 100, 100);
      expect(cost).toBe(0);
    });

    it('should calculate cost with only input tokens', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-3.5-turbo',
        provider: 'openai',
        userInputPrice: '0.5',
        userOutputPrice: '1.5',
        perRequestPrice: '0',
        subProvider: null,
      });

      // 100,000 input tokens at $0.5 / 1M = $0.05
      const cost = await service.calculateCost('gpt-3.5-turbo', 'openai', 100_000, 0);
      expect(cost).toBeCloseTo(0.05, 6);
    });
  });

  describe('deductCredits', () => {
    it('should not deduct when amount is 0', async () => {
      await service.deductCredits(0, 'test');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should not deduct when amount is negative', async () => {
      await service.deductCredits(-5, 'test');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw error when user balance is not found', async () => {
      mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(null),
            },
          },
          update: vi.fn(),
          insert: vi.fn(),
        };
        return fn(mockTx);
      });

      await expect(service.deductCredits(10, 'test description')).rejects.toThrow(
        'User balance not found',
      );
    });

    it('should throw error when balance is insufficient', async () => {
      mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
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
        return fn(mockTx);
      });

      await expect(service.deductCredits(10, 'test description')).rejects.toThrow(
        'Insufficient credits',
      );
    });

    it('should deduct credits and record transaction when balance is sufficient', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
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
        return fn(mockTx);
      });

      const result = await service.deductCredits(10, 'API usage', 'msg-123');

      expect(result).toBeCloseTo(90, 4);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should allow deduction for unlimited balance users even when balance is low', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId,
                balance: '1.0000',
                isUnlimited: true,
              }),
            },
          },
          update: mockUpdate,
          insert: mockInsert,
        };
        return fn(mockTx);
      });

      const result = await service.deductCredits(1000, 'Unlimited user usage');
      expect(result).toBeCloseTo(-999, 4);
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when user balance does not exist', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue(null);

      const result = await service.hasEnoughCredits();
      expect(result).toBe(false);
    });

    it('should return true for unlimited balance users regardless of amount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: true,
      });

      const result = await service.hasEnoughCredits(9999);
      expect(result).toBe(true);
    });

    it('should return true when balance is positive and no estimatedAmount provided', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '10.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits();
      expect(result).toBe(true);
    });

    it('should return false when balance is zero and no estimatedAmount provided', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits();
      expect(result).toBe(false);
    });

    it('should return true when balance meets estimated amount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '50.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(50);
      expect(result).toBe(true);
    });

    it('should return false when balance is less than estimated amount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '30.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(50);
      expect(result).toBe(false);
    });

    it('should return true when estimated amount is 0 and balance is positive', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '5.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(0);
      expect(result).toBe(true);
    });
  });
});
