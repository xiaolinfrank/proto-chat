// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';

import { CreditService } from './index';

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: LobeChatDatabase;
  const userId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {} as unknown as LobeChatDatabase;
    service = new CreditService(mockDb, userId);
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using own API key', async () => {
      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);

      expect(cost).toBe(0);
    });

    it('should return 0 when no pricing found for model/provider', async () => {
      mockDb.query = {
        modelPricings: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as any;

      const cost = await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);

      expect(cost).toBe(0);
    });

    it('should calculate cost correctly with valid pricing', async () => {
      mockDb.query = {
        modelPricings: {
          findFirst: vi.fn().mockResolvedValue({
            model: 'gpt-4',
            provider: 'openai',
            userInputPrice: '10.0', // 10 credits per 1M tokens
            userOutputPrice: '20.0', // 20 credits per 1M tokens
            perRequestPrice: '0.01',
          }),
        },
      } as any;

      // 1,000,000 input tokens and 500,000 output tokens
      // Expected: (1,000,000 / 1,000,000) * 10 + (500,000 / 1,000,000) * 20 + 0.01
      // = 1 * 10 + 0.5 * 20 + 0.01 = 10 + 10 + 0.01 = 20.01
      const cost = await service.calculateCost('gpt-4', 'openai', 1_000_000, 500_000);

      expect(cost).toBe(20.01);
    });

    it('should handle zero tokens correctly', async () => {
      mockDb.query = {
        modelPricings: {
          findFirst: vi.fn().mockResolvedValue({
            model: 'gpt-4',
            provider: 'openai',
            userInputPrice: '10.0',
            userOutputPrice: '20.0',
            perRequestPrice: '0.01',
          }),
        },
      } as any;

      const cost = await service.calculateCost('gpt-4', 'openai', 0, 0);

      expect(cost).toBe(0.01); // Only per-request price
    });

    it('should handle missing price fields with defaults', async () => {
      mockDb.query = {
        modelPricings: {
          findFirst: vi.fn().mockResolvedValue({
            model: 'gpt-4',
            provider: 'openai',
            userInputPrice: null,
            userOutputPrice: null,
            perRequestPrice: null,
          }),
        },
      } as any;

      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500);

      expect(cost).toBe(0);
    });

    it('should calculate cost with subProvider info', async () => {
      mockDb.query = {
        modelPricings: {
          findFirst: vi.fn().mockResolvedValue({
            model: 'gpt-4',
            provider: 'protochat',
            subProvider: 'openai',
            userInputPrice: '5.0',
            userOutputPrice: '10.0',
            perRequestPrice: '0',
          }),
        },
      } as any;

      const cost = await service.calculateCost('gpt-4', 'protochat', 100_000, 50_000);

      // (100,000 / 1,000,000) * 5 + (50,000 / 1,000,000) * 10
      // = 0.1 * 5 + 0.05 * 10 = 0.5 + 0.5 = 1.0
      expect(cost).toBe(1.0);
    });

    it('should handle small token amounts correctly', async () => {
      mockDb.query = {
        modelPricings: {
          findFirst: vi.fn().mockResolvedValue({
            model: 'gpt-4',
            provider: 'openai',
            userInputPrice: '10.0',
            userOutputPrice: '20.0',
            perRequestPrice: '0',
          }),
        },
      } as any;

      const cost = await service.calculateCost('gpt-4', 'openai', 100, 50);

      // (100 / 1,000,000) * 10 + (50 / 1,000,000) * 20
      // = 0.001 + 0.001 = 0.002
      expect(cost).toBeCloseTo(0.002, 3);
    });
  });

  describe('deductCredits', () => {
    it('should do nothing when amount is 0', async () => {
      await service.deductCredits(0, 'test');

      // Transaction should not be called
      expect(mockDb.transaction).toBeUndefined();
    });

    it('should do nothing when amount is negative', async () => {
      await service.deductCredits(-5, 'test');

      // Transaction should not be called
      expect(mockDb.transaction).toBeUndefined();
    });

    it('should throw error when user balance not found', async () => {
      const mockTx = {
        query: {
          userBalances: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      };

      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('User balance not found');
    });

    it('should throw error when insufficient credits', async () => {
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

      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('Insufficient credits');
    });

    it('should deduct credits successfully with limited balance', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

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

      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const newBalance = await service.deductCredits(10.5, 'Test deduction', 'ref-123', {
        test: 'metadata',
      });

      expect(newBalance).toBe(89.5);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should allow deduction for unlimited balance even when balance is low', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const mockTx = {
        query: {
          userBalances: {
            findFirst: vi.fn().mockResolvedValue({
              userId,
              balance: '5.0',
              isUnlimited: true, // Unlimited balance
            }),
          },
        },
        update: mockUpdate,
        insert: mockInsert,
      };

      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const newBalance = await service.deductCredits(10, 'Test deduction');

      expect(newBalance).toBe(-5.0); // Can go negative with unlimited
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should create transaction record with correct values', async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: mockValues,
      });

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

      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      await service.deductCredits(25.5, 'API Call', 'msg-123', { model: 'gpt-4' });

      // Verify the transaction values were called with expected structure
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '-25.5000',
          balanceAfter: '74.5000',
          category: 'CONSUMPTION',
          description: 'API Call',
          refId: 'msg-123',
          type: 'CONSUMPTION',
          userId: userId,
          metadata: { model: 'gpt-4' },
        }),
      );
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when user balance not found', async () => {
      mockDb.query = {
        userBalances: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as any;

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true for unlimited balance regardless of amount', async () => {
      mockDb.query = {
        userBalances: {
          findFirst: vi.fn().mockResolvedValue({
            userId,
            balance: '0.0',
            isUnlimited: true,
          }),
        },
      } as any;

      const result = await service.hasEnoughCredits(1000);

      expect(result).toBe(true);
    });

    it('should return true when balance is positive and no estimate provided', async () => {
      mockDb.query = {
        userBalances: {
          findFirst: vi.fn().mockResolvedValue({
            userId,
            balance: '10.0',
            isUnlimited: false,
          }),
        },
      } as any;

      const result = await service.hasEnoughCredits();

      expect(result).toBe(true);
    });

    it('should return false when balance is zero and no estimate provided', async () => {
      mockDb.query = {
        userBalances: {
          findFirst: vi.fn().mockResolvedValue({
            userId,
            balance: '0.0',
            isUnlimited: false,
          }),
        },
      } as any;

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when balance is greater than estimated amount', async () => {
      mockDb.query = {
        userBalances: {
          findFirst: vi.fn().mockResolvedValue({
            userId,
            balance: '100.0',
            isUnlimited: false,
          }),
        },
      } as any;

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should return true when balance equals estimated amount', async () => {
      mockDb.query = {
        userBalances: {
          findFirst: vi.fn().mockResolvedValue({
            userId,
            balance: '50.0',
            isUnlimited: false,
          }),
        },
      } as any;

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should return false when balance is less than estimated amount', async () => {
      mockDb.query = {
        userBalances: {
          findFirst: vi.fn().mockResolvedValue({
            userId,
            balance: '30.0',
            isUnlimited: false,
          }),
        },
      } as any;

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(false);
    });

    it('should handle edge case with very small balance correctly', async () => {
      mockDb.query = {
        userBalances: {
          findFirst: vi.fn().mockResolvedValue({
            userId,
            balance: '0.0001',
            isUnlimited: false,
          }),
        },
      } as any;

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(true);
    });
  });
});
