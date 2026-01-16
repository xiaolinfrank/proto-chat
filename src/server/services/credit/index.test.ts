// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LobeChatDatabase } from '@/database/type';
import { CreditService } from './index';

// Mock idGenerator
vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn((namespace: string) => `${namespace}_mock123`),
}));

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: any;
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock database instance with query methods
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
      update: vi.fn(),
      insert: vi.fn(),
    } as unknown as LobeChatDatabase;

    service = new CreditService(mockDb, mockUserId);

    // Mock console methods to avoid cluttering test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('calculateCost', () => {
    it('should return 0 when isUserConfig is true', async () => {
      const cost = await service.calculateCost(
        'gpt-4',
        'openai',
        1000,
        500,
        true,
      );

      expect(cost).toBe(0);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Credit] User using own config for openai, no charge'),
      );
      expect(mockDb.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when pricing not found', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(null);

      const cost = await service.calculateCost(
        'unknown-model',
        'unknown-provider',
        1000,
        500,
        false,
      );

      expect(cost).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[Credit] No pricing found for unknown-provider::unknown-model, no charge'),
      );
    });

    it('should calculate cost correctly with valid pricing', async () => {
      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.5000',
        userOutputPrice: '20.0000',
        perRequestPrice: '0.1000',
        subProvider: null,
      };

      mockDb.query.modelPricings.findFirst.mockResolvedValue(mockPricing);

      const inputTokens = 1_000_000; // 1M tokens
      const outputTokens = 500_000; // 0.5M tokens
      const cost = await service.calculateCost(
        'gpt-4',
        'openai',
        inputTokens,
        outputTokens,
        false,
      );

      // Expected: (1M / 1M) * 10.5 + (0.5M / 1M) * 20 + 0.1 = 10.5 + 10 + 0.1 = 20.6
      expect(cost).toBe(20.6);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Credit] Charging for openai::gpt-4, cost: 20.6000 credits'),
      );
    });

    it('should calculate cost with sub-provider info', async () => {
      const mockPricing = {
        model: 'deepseek-chat',
        provider: 'protochat',
        userInputPrice: '5.0000',
        userOutputPrice: '10.0000',
        perRequestPrice: '0.0500',
        subProvider: 'deepseek',
      };

      mockDb.query.modelPricings.findFirst.mockResolvedValue(mockPricing);

      const cost = await service.calculateCost(
        'deepseek-chat',
        'protochat',
        100_000,
        50_000,
        false,
      );

      // Expected: (0.1M) * 5 + (0.05M) * 10 + 0.05 = 0.5 + 0.5 + 0.05 = 1.05
      expect(cost).toBe(1.05);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Credit] Charging for protochat::deepseek-chat (via deepseek)'),
      );
    });

    it('should handle zero tokens', async () => {
      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.0000',
        userOutputPrice: '20.0000',
        perRequestPrice: '0.1000',
        subProvider: null,
      };

      mockDb.query.modelPricings.findFirst.mockResolvedValue(mockPricing);

      const cost = await service.calculateCost('gpt-4', 'openai', 0, 0, false);

      // Expected: 0 + 0 + 0.1 = 0.1 (only per-request fee)
      expect(cost).toBe(0.1);
    });

    it('should handle null pricing values as zero', async () => {
      const mockPricing = {
        model: 'test-model',
        provider: 'test-provider',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
        subProvider: null,
      };

      mockDb.query.modelPricings.findFirst.mockResolvedValue(mockPricing);

      const cost = await service.calculateCost(
        'test-model',
        'test-provider',
        1_000_000,
        1_000_000,
        false,
      );

      expect(cost).toBe(0);
    });

    it('should query database with correct model and provider', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(null);

      await service.calculateCost('gpt-4-turbo', 'openai', 1000, 500, false);

      expect(mockDb.query.modelPricings.findFirst).toHaveBeenCalledWith({
        where: expect.any(Object),
      });
    });
  });

  describe('deductCredits', () => {
    it('should return early when amount is zero or negative', async () => {
      await service.deductCredits(0, 'test');
      expect(mockDb.transaction).not.toHaveBeenCalled();

      await service.deductCredits(-10, 'test');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should deduct credits successfully with unlimited balance', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '100.0000',
        isUnlimited: true,
        totalPurchased: '0.0000',
      };

      const mockTransaction = vi.fn(async (callback: any) => {
        const tx = {
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
        return callback(tx);
      });

      mockDb.transaction = mockTransaction;

      const newBalance = await service.deductCredits(
        10,
        'Test deduction',
        'ref-123',
        { test: 'metadata' },
      );

      expect(newBalance).toBe(90);
    });

    it('should deduct credits successfully with sufficient balance', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '100.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
      };

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const mockUpdate = vi.fn().mockReturnValue({
        set: mockSet,
      });

      const mockValues = vi.fn().mockResolvedValue(undefined);
      const mockInsert = vi.fn().mockReturnValue({
        values: mockValues,
      });

      const mockTransaction = vi.fn(async (callback: any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(mockBalance),
            },
          },
          update: mockUpdate,
          insert: mockInsert,
        };
        return callback(tx);
      });

      mockDb.transaction = mockTransaction;

      const newBalance = await service.deductCredits(
        25.5,
        'API usage',
        'msg-456',
      );

      expect(newBalance).toBe(74.5);

      // Verify update was called
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalled();
      const setCall = mockSet.mock.calls[0][0];
      expect(setCall).toMatchObject({
        balance: '74.5000',
      });

      // Verify transaction insert was called
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalled();
      const insertCall = mockValues.mock.calls[0][0];
      expect(insertCall).toMatchObject({
        amount: '-25.5000',
        balanceAfter: '74.5000',
        category: 'CONSUMPTION',
        description: 'API usage',
        type: 'CONSUMPTION',
        userId: mockUserId,
        refId: 'msg-456',
      });
      expect(insertCall.id).toMatch(/^tx_/);
    });

    it('should throw error when user balance not found', async () => {
      const mockTransaction = vi.fn(async (callback: any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(null),
            },
          },
        };
        return callback(tx);
      });

      mockDb.transaction = mockTransaction;

      await expect(
        service.deductCredits(10, 'Test'),
      ).rejects.toThrow('User balance not found');
    });

    it('should throw error when insufficient credits', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '5.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
      };

      const mockTransaction = vi.fn(async (callback: any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(mockBalance),
            },
          },
        };
        return callback(tx);
      });

      mockDb.transaction = mockTransaction;

      await expect(
        service.deductCredits(10, 'Test'),
      ).rejects.toThrow('Insufficient credits');
    });

    it('should handle exact balance deduction', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '10.0000',
        isUnlimited: false,
        totalPurchased: '10.0000',
      };

      const mockTransaction = vi.fn(async (callback: any) => {
        const tx = {
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
        return callback(tx);
      });

      mockDb.transaction = mockTransaction;

      const newBalance = await service.deductCredits(10, 'Exact deduction');

      expect(newBalance).toBe(0);
    });

    it('should include metadata when provided', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '100.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
      };

      const mockValues = vi.fn().mockResolvedValue(undefined);
      const mockInsert = vi.fn().mockReturnValue({
        values: mockValues,
      });

      const mockTransaction = vi.fn(async (callback: any) => {
        const tx = {
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
          insert: mockInsert,
        };
        return callback(tx);
      });

      mockDb.transaction = mockTransaction;

      const metadata = { model: 'gpt-4', provider: 'openai', tokens: 1000 };
      await service.deductCredits(5, 'API call', 'msg-789', metadata);

      expect(mockValues).toHaveBeenCalled();
      const insertCall = mockValues.mock.calls[0][0];
      expect(insertCall.metadata).toEqual(metadata);
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when balance not found', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue(null);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when balance is unlimited', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '0.0000',
        isUnlimited: true,
        totalPurchased: '0.0000',
      };

      mockDb.query.userBalances.findFirst.mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(1000);

      expect(result).toBe(true);
    });

    it('should return true when current balance is greater than zero with no estimated amount', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '50.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
      };

      mockDb.query.userBalances.findFirst.mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(true);
    });

    it('should return false when current balance is zero with no estimated amount', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '0.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
      };

      mockDb.query.userBalances.findFirst.mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(false);
    });

    it('should return true when balance is sufficient for estimated amount', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '100.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
      };

      mockDb.query.userBalances.findFirst.mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should return false when balance is insufficient for estimated amount', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '10.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
      };

      mockDb.query.userBalances.findFirst.mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(false);
    });

    it('should return true when balance exactly matches estimated amount', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '50.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
      };

      mockDb.query.userBalances.findFirst.mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should handle very small balances', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '0.0001',
        isUnlimited: false,
        totalPurchased: '100.0000',
      };

      mockDb.query.userBalances.findFirst.mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(true);
    });

    it('should handle very large estimated amounts', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '1000.0000',
        isUnlimited: false,
        totalPurchased: '1000.0000',
      };

      mockDb.query.userBalances.findFirst.mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(999999);

      expect(result).toBe(false);
    });
  });
});
