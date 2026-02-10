// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';
import { modelPricings, userBalances, userTransactions } from '@/database/schemas';

import { CreditService } from './index';

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: LobeChatDatabase;
  const userId = 'test-user-id';

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create a mock database instance
    mockDb = {} as unknown as LobeChatDatabase;

    service = new CreditService(mockDb, userId);
  });

  describe('calculateCost', () => {
    it('should return 0 when isUserConfig is true', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const cost = await service.calculateCost(
        'gpt-4',
        'openai',
        1000,
        500,
        true,
      );

      expect(cost).toBe(0);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Credit] User using own config for openai, no charge',
      );

      consoleSpy.mockRestore();
    });

    it('should return 0 when no pricing found for model', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockDb.query = {
        modelPricings: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as any;

      const cost = await service.calculateCost(
        'unknown-model',
        'unknown-provider',
        1000,
        500,
        false,
      );

      expect(cost).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Credit] No pricing found for unknown-provider::unknown-model, no charge',
      );

      consoleWarnSpy.mockRestore();
    });

    it('should calculate cost correctly with valid pricing', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0000',
        userOutputPrice: '20.0000',
        perRequestPrice: '0.0010',
        subProvider: null,
      };

      mockDb.query = {
        modelPricings: {
          findFirst: vi.fn().mockResolvedValue(mockPricing),
        },
      } as any;

      // Calculate expected cost:
      // inputTokens: 1,000,000 / 1,000,000 * 10 = 10
      // outputTokens: 500,000 / 1,000,000 * 20 = 10
      // perRequest: 0.001
      // total: 10 + 10 + 0.001 = 20.001
      const cost = await service.calculateCost(
        'gpt-4',
        'openai',
        1_000_000,
        500_000,
        false,
      );

      expect(cost).toBeCloseTo(20.001, 4);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Credit] Charging for openai::gpt-4, cost: 20.0010 credits',
      );

      consoleSpy.mockRestore();
    });

    it('should calculate cost correctly with small token counts', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0000',
        userOutputPrice: '20.0000',
        perRequestPrice: '0.0010',
        subProvider: null,
      };

      mockDb.query = {
        modelPricings: {
          findFirst: vi.fn().mockResolvedValue(mockPricing),
        },
      } as any;

      // Calculate expected cost:
      // inputTokens: 1,000 / 1,000,000 * 10 = 0.01
      // outputTokens: 500 / 1,000,000 * 20 = 0.01
      // perRequest: 0.001
      // total: 0.01 + 0.01 + 0.001 = 0.021
      const cost = await service.calculateCost(
        'gpt-4',
        'openai',
        1_000,
        500,
        false,
      );

      expect(cost).toBeCloseTo(0.021, 4);

      consoleSpy.mockRestore();
    });

    it('should include subProvider in log when present', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockPricing = {
        model: 'gpt-4',
        provider: 'protochat',
        userInputPrice: '10.0000',
        userOutputPrice: '20.0000',
        perRequestPrice: '0.0000',
        subProvider: 'openrouter',
      };

      mockDb.query = {
        modelPricings: {
          findFirst: vi.fn().mockResolvedValue(mockPricing),
        },
      } as any;

      await service.calculateCost(
        'gpt-4',
        'protochat',
        1_000,
        500,
        false,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('protochat::gpt-4 (via openrouter)'),
      );

      consoleSpy.mockRestore();
    });

    it('should handle zero token counts', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0000',
        userOutputPrice: '20.0000',
        perRequestPrice: '0.0010',
        subProvider: null,
      };

      mockDb.query = {
        modelPricings: {
          findFirst: vi.fn().mockResolvedValue(mockPricing),
        },
      } as any;

      const cost = await service.calculateCost(
        'gpt-4',
        'openai',
        0,
        0,
        false,
      );

      expect(cost).toBeCloseTo(0.001, 4);

      consoleSpy.mockRestore();
    });

    it('should handle null pricing values gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
        subProvider: null,
      };

      mockDb.query = {
        modelPricings: {
          findFirst: vi.fn().mockResolvedValue(mockPricing),
        },
      } as any;

      const cost = await service.calculateCost(
        'gpt-4',
        'openai',
        1_000,
        500,
        false,
      );

      expect(cost).toBe(0);

      consoleSpy.mockRestore();
    });
  });

  describe('deductCredits', () => {
    it('should not deduct when amount is 0', async () => {
      const result = await service.deductCredits(0, 'test description');
      expect(result).toBeUndefined();
    });

    it('should not deduct when amount is negative', async () => {
      const result = await service.deductCredits(-10, 'test description');
      expect(result).toBeUndefined();
    });

    it('should successfully deduct credits from user balance', async () => {
      const mockBalance = {
        userId: userId,
        balance: '100.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTx = {
        query: {
          userBalances: {
            findFirst: vi.fn().mockResolvedValue(mockBalance),
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

      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx as any);
      });

      const result = await service.deductCredits(25.5, 'Test charge', 'ref-123', { test: true });

      expect(result).toBeCloseTo(74.5, 4);
      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalled();
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
        return callback(mockTx as any);
      });

      await expect(service.deductCredits(10, 'Test')).rejects.toThrow('User balance not found');
    });

    it('should throw error when insufficient credits', async () => {
      const mockBalance = {
        userId: userId,
        balance: '5.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTx = {
        query: {
          userBalances: {
            findFirst: vi.fn().mockResolvedValue(mockBalance),
          },
        },
      };

      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx as any);
      });

      await expect(service.deductCredits(10, 'Test')).rejects.toThrow('Insufficient credits');
    });

    it('should allow deduction for unlimited accounts regardless of balance', async () => {
      const mockBalance = {
        userId: userId,
        balance: '0.0000',
        isUnlimited: true,
        totalPurchased: '0.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTx = {
        query: {
          userBalances: {
            findFirst: vi.fn().mockResolvedValue(mockBalance),
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

      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx as any);
      });

      const result = await service.deductCredits(50, 'Test unlimited');

      expect(result).toBeCloseTo(-50, 4);
      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalled();
    });

    it('should create transaction record with correct metadata', async () => {
      const mockBalance = {
        userId: userId,
        balance: '100.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let insertedTransaction: any = null;

      const mockTx = {
        query: {
          userBalances: {
            findFirst: vi.fn().mockResolvedValue(mockBalance),
          },
        },
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn((data: any) => {
            insertedTransaction = data;
            return Promise.resolve(undefined);
          }),
        }),
      };

      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        return callback(mockTx as any);
      });

      const metadata = { model: 'gpt-4', tokens: 1000 };
      await service.deductCredits(10, 'Model usage', 'msg-123', metadata);

      expect(insertedTransaction).toMatchObject({
        amount: '-10.0000',
        balanceAfter: '90.0000',
        category: 'CONSUMPTION',
        description: 'Model usage',
        refId: 'msg-123',
        metadata,
        type: 'CONSUMPTION',
        userId: userId,
      });
      expect(insertedTransaction.id).toMatch(/^tx_/);
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when balance not found', async () => {
      mockDb.query = {
        userBalances: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      } as any;

      const result = await service.hasEnoughCredits();
      expect(result).toBe(false);
    });

    it('should return true for unlimited accounts', async () => {
      const mockBalance = {
        userId: userId,
        balance: '0.0000',
        isUnlimited: true,
        totalPurchased: '0.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query = {
        userBalances: {
          findFirst: vi.fn().mockResolvedValue(mockBalance),
        },
      } as any;

      const result = await service.hasEnoughCredits(1000);
      expect(result).toBe(true);
    });

    it('should return true when balance is greater than 0 and no estimated amount', async () => {
      const mockBalance = {
        userId: userId,
        balance: '10.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query = {
        userBalances: {
          findFirst: vi.fn().mockResolvedValue(mockBalance),
        },
      } as any;

      const result = await service.hasEnoughCredits();
      expect(result).toBe(true);
    });

    it('should return false when balance is 0 and no estimated amount', async () => {
      const mockBalance = {
        userId: userId,
        balance: '0.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query = {
        userBalances: {
          findFirst: vi.fn().mockResolvedValue(mockBalance),
        },
      } as any;

      const result = await service.hasEnoughCredits();
      expect(result).toBe(false);
    });

    it('should return true when balance is greater than or equal to estimated amount', async () => {
      const mockBalance = {
        userId: userId,
        balance: '50.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query = {
        userBalances: {
          findFirst: vi.fn().mockResolvedValue(mockBalance),
        },
      } as any;

      const result1 = await service.hasEnoughCredits(50);
      expect(result1).toBe(true);

      const result2 = await service.hasEnoughCredits(25);
      expect(result2).toBe(true);
    });

    it('should return false when balance is less than estimated amount', async () => {
      const mockBalance = {
        userId: userId,
        balance: '25.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query = {
        userBalances: {
          findFirst: vi.fn().mockResolvedValue(mockBalance),
        },
      } as any;

      const result = await service.hasEnoughCredits(50);
      expect(result).toBe(false);
    });

    it('should handle edge case with exact balance match', async () => {
      const mockBalance = {
        userId: userId,
        balance: '100.5000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.query = {
        userBalances: {
          findFirst: vi.fn().mockResolvedValue(mockBalance),
        },
      } as any;

      const result = await service.hasEnoughCredits(100.5);
      expect(result).toBe(true);
    });
  });
});
