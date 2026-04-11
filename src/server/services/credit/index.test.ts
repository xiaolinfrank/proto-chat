// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';

import { CreditService } from './index';

// Mock idGenerator to return predictable values
vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn().mockReturnValue('tx_testid123456'),
}));

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: any;
  const userId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();

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
    };

    service = new CreditService(mockDb as unknown as LobeChatDatabase, userId);
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using own config', async () => {
      const result = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);
      expect(result).toBe(0);
      expect(mockDb.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing found for model', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(null);

      const result = await service.calculateCost('unknown-model', 'openai', 1000, 500);
      expect(result).toBe(0);
    });

    it('should calculate cost correctly with input and output tokens', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10',   // 10 credits per 1M input tokens
        userOutputPrice: '30',  // 30 credits per 1M output tokens
        perRequestPrice: '0',
        subProvider: null,
      });

      // 1M input tokens + 1M output tokens → 10 + 30 = 40 credits
      const result = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);
      expect(result).toBeCloseTo(40, 4);
    });

    it('should include per-request price in cost calculation', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '0',
        userOutputPrice: '0',
        perRequestPrice: '0.5',
        subProvider: null,
      });

      const result = await service.calculateCost('gpt-4', 'openai', 0, 0);
      expect(result).toBeCloseTo(0.5, 4);
    });

    it('should calculate cost proportionally for partial millions of tokens', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'claude-3',
        provider: 'anthropic',
        userInputPrice: '2',    // 2 credits per 1M input tokens
        userOutputPrice: '6',   // 6 credits per 1M output tokens
        perRequestPrice: '0',
        subProvider: null,
      });

      // 500K input → 1 credit, 200K output → 1.2 credits
      const result = await service.calculateCost('claude-3', 'anthropic', 500_000, 200_000);
      expect(result).toBeCloseTo(1 + 1.2, 4);
    });

    it('should handle null pricing fields as zero', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'test-model',
        provider: 'test-provider',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
        subProvider: null,
      });

      const result = await service.calculateCost('test-model', 'test-provider', 1000, 1000);
      expect(result).toBe(0);
    });

    it('should handle empty string pricing fields as zero', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'test-model',
        provider: 'test-provider',
        userInputPrice: '',
        userOutputPrice: '',
        perRequestPrice: '',
        subProvider: null,
      });

      const result = await service.calculateCost('test-model', 'test-provider', 1000, 1000);
      expect(result).toBe(0);
    });

    it('should query database with correct model and provider', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(null);

      await service.calculateCost('deepseek-chat', 'deepseek', 100, 200);

      expect(mockDb.query.modelPricings.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        }),
      );
    });

    it('should return 0 cost for zero tokens', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10',
        userOutputPrice: '30',
        perRequestPrice: '0',
        subProvider: null,
      });

      const result = await service.calculateCost('gpt-4', 'openai', 0, 0);
      expect(result).toBe(0);
    });

    it('should default isUserConfig to false when not provided', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(null);

      // Should attempt DB query (isUserConfig defaults to false)
      await service.calculateCost('gpt-4', 'openai', 100, 100);
      expect(mockDb.query.modelPricings.findFirst).toHaveBeenCalled();
    });
  });

  describe('deductCredits', () => {
    it('should return early without any DB calls when amount is 0', async () => {
      await service.deductCredits(0, 'test deduction');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should return early without any DB calls when amount is negative', async () => {
      await service.deductCredits(-5, 'negative deduction');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw when user balance not found', async () => {
      mockDb.transaction.mockImplementation(async (callback: Function) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(null),
            },
          },
          update: vi.fn(),
          insert: vi.fn(),
        };
        return callback(mockTx);
      });

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('User balance not found');
    });

    it('should throw when user has insufficient credits', async () => {
      mockDb.transaction.mockImplementation(async (callback: Function) => {
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
        return callback(mockTx);
      });

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('Insufficient credits');
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

      mockDb.transaction.mockImplementation(async (callback: Function) => {
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

      const result = await service.deductCredits(30, 'chat usage');
      expect(result).toBeCloseTo(70, 4);
    });

    it('should allow deduction even if balance is low when isUnlimited is true', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      mockDb.transaction.mockImplementation(async (callback: Function) => {
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
        return callback(mockTx);
      });

      // Unlimited user can deduct more than their balance
      const result = await service.deductCredits(100, 'unlimited usage');
      expect(result).toBeCloseTo(-99, 4);
    });

    it('should update balance with correct precision (4 decimal places)', async () => {
      const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
      const updateMock = vi.fn().mockReturnValue({ set: setMock });
      const insertValuesMock = vi.fn().mockResolvedValue(undefined);
      const insertMock = vi.fn().mockReturnValue({ values: insertValuesMock });

      mockDb.transaction.mockImplementation(async (callback: Function) => {
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
          update: updateMock,
          insert: insertMock,
        };
        return callback(mockTx);
      });

      await service.deductCredits(3.5, 'precision test');

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          balance: '6.5000',
        }),
      );
    });

    it('should insert transaction record with correct values', async () => {
      const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
      const updateMock = vi.fn().mockReturnValue({ set: setMock });
      const insertValuesMock = vi.fn().mockResolvedValue(undefined);
      const insertMock = vi.fn().mockReturnValue({ values: insertValuesMock });

      mockDb.transaction.mockImplementation(async (callback: Function) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId,
                balance: '50.0000',
                isUnlimited: false,
              }),
            },
          },
          update: updateMock,
          insert: insertMock,
        };
        return callback(mockTx);
      });

      const metadata = { model: 'gpt-4' };
      const refId = 'msg_123';
      await service.deductCredits(5, 'test description', refId, metadata);

      expect(insertValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '-5.0000',
          balanceAfter: '45.0000',
          category: 'CONSUMPTION',
          description: 'test description',
          type: 'CONSUMPTION',
          userId,
          refId,
          metadata,
        }),
      );
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when balance record not found', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue(null);

      const result = await service.hasEnoughCredits();
      expect(result).toBe(false);
    });

    it('should return true when user is unlimited regardless of balance', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: true,
      });

      const result = await service.hasEnoughCredits(9999);
      expect(result).toBe(true);
    });

    it('should return true when balance > 0 and estimatedAmount is 0', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '10.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(0);
      expect(result).toBe(true);
    });

    it('should return false when balance is 0 and estimatedAmount is 0', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(0);
      expect(result).toBe(false);
    });

    it('should return true when balance >= estimatedAmount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '20.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(20);
      expect(result).toBe(true);
    });

    it('should return false when balance < estimatedAmount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '5.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(10);
      expect(result).toBe(false);
    });

    it('should default estimatedAmount to 0 when not provided', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '5.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits();
      // balance > 0, so should return true
      expect(result).toBe(true);
    });

    it('should query database for the correct user', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue(null);

      await service.hasEnoughCredits();

      expect(mockDb.query.userBalances.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        }),
      );
    });
  });
});
