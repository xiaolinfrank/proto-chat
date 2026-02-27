// @vitest-environment node
import { LobeChatDatabase } from '@/database/type';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreditService } from './index';

// Mock the idGenerator utility
vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn((prefix: string) => `${prefix}_mock_id_123`),
}));

describe('CreditService', () => {
  let mockDb: LobeChatDatabase;
  let creditService: CreditService;
  const mockUserId = 'user_123';

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock database with query and transaction support
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
    } as any;

    creditService = new CreditService(mockDb, mockUserId);
  });

  describe('calculateCost', () => {
    it('should calculate cost correctly with valid pricing', async () => {
      const mockPricing = {
        inputPrice: '10.000000', // 10 credits per 1M tokens
        outputPrice: '20.000000', // 20 credits per 1M tokens
        perRequestPrice: '0.500000', // 0.5 credits per request
      };

      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(mockPricing as any);

      const cost = await creditService.calculateCost('gpt-4', 'openai', 500_000, 250_000);

      // Expected: (500_000 / 1_000_000) * 10 + (250_000 / 1_000_000) * 20 + 0.5
      // = 0.5 * 10 + 0.25 * 20 + 0.5
      // = 5 + 5 + 0.5 = 10.5
      expect(cost).toBe(10.5);
      expect(mockDb.query.modelPricings.findFirst).toHaveBeenCalledWith({
        where: expect.anything(),
      });
    });

    it('should return 0 when pricing is not found', async () => {
      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(undefined);

      const cost = await creditService.calculateCost('unknown-model', 'unknown-provider', 1000, 1000);

      expect(cost).toBe(0);
    });

    it('should handle null price values as 0', async () => {
      const mockPricing = {
        inputPrice: null,
        outputPrice: null,
        perRequestPrice: null,
      };

      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(mockPricing as any);

      const cost = await creditService.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);

      expect(cost).toBe(0);
    });

    it('should handle zero tokens correctly', async () => {
      const mockPricing = {
        inputPrice: '10.000000',
        outputPrice: '20.000000',
        perRequestPrice: '0.500000',
      };

      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(mockPricing as any);

      const cost = await creditService.calculateCost('gpt-4', 'openai', 0, 0);

      // Only per-request price should be charged
      expect(cost).toBe(0.5);
    });

    it('should handle fractional token counts', async () => {
      const mockPricing = {
        inputPrice: '10.000000',
        outputPrice: '20.000000',
        perRequestPrice: '0.000000',
      };

      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(mockPricing as any);

      const cost = await creditService.calculateCost('gpt-4', 'openai', 1_500, 2_500);

      // Expected: (1_500 / 1_000_000) * 10 + (2_500 / 1_000_000) * 20
      // = 0.0015 * 10 + 0.0025 * 20
      // = 0.015 + 0.05 = 0.065
      expect(cost).toBe(0.065);
    });

    it('should handle large token counts', async () => {
      const mockPricing = {
        inputPrice: '5.000000',
        outputPrice: '15.000000',
        perRequestPrice: '1.000000',
      };

      vi.mocked(mockDb.query.modelPricings.findFirst).mockResolvedValue(mockPricing as any);

      const cost = await creditService.calculateCost('gpt-4', 'openai', 10_000_000, 5_000_000);

      // Expected: (10_000_000 / 1_000_000) * 5 + (5_000_000 / 1_000_000) * 15 + 1
      // = 10 * 5 + 5 * 15 + 1
      // = 50 + 75 + 1 = 126
      expect(cost).toBe(126);
    });
  });

  describe('deductCredits', () => {
    it('should deduct credits successfully when balance is sufficient', async () => {
      const mockBalance = {
        balance: '100.0000',
        isUnlimited: false,
        userId: mockUserId,
      };

      const mockTransaction = vi.fn(async (callback) => {
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
        return callback(mockTx);
      });

      mockDb.transaction = mockTransaction as any;

      const result = await creditService.deductCredits(25.5, 'Test deduction', 'ref_123', {
        modelId: 'gpt-4',
      });

      expect(result).toBe(74.5);
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should throw error when user balance is not found', async () => {
      const mockTransaction = vi.fn(async (callback) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(undefined),
            },
          },
        };
        return callback(mockTx);
      });

      mockDb.transaction = mockTransaction as any;

      await expect(creditService.deductCredits(10, 'Test deduction')).rejects.toThrow(
        'User balance not found',
      );
    });

    it('should throw error when insufficient credits', async () => {
      const mockBalance = {
        balance: '10.0000',
        isUnlimited: false,
        userId: mockUserId,
      };

      const mockTransaction = vi.fn(async (callback) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(mockBalance),
            },
          },
        };
        return callback(mockTx);
      });

      mockDb.transaction = mockTransaction as any;

      await expect(creditService.deductCredits(50, 'Test deduction')).rejects.toThrow(
        'Insufficient credits',
      );
    });

    it('should allow deduction when user has unlimited credits', async () => {
      const mockBalance = {
        balance: '10.0000',
        isUnlimited: true,
        userId: mockUserId,
      };

      const mockTransaction = vi.fn(async (callback) => {
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
        return callback(mockTx);
      });

      mockDb.transaction = mockTransaction as any;

      const result = await creditService.deductCredits(
        100,
        'Test unlimited deduction',
        'ref_unlimited',
      );

      // Balance after deduction should still be calculated
      expect(result).toBe(-90);
    });

    it('should not deduct when amount is zero', async () => {
      const mockTransaction = vi.fn();
      mockDb.transaction = mockTransaction as any;

      const result = await creditService.deductCredits(0, 'Zero amount');

      expect(result).toBeUndefined();
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should not deduct when amount is negative', async () => {
      const mockTransaction = vi.fn();
      mockDb.transaction = mockTransaction as any;

      const result = await creditService.deductCredits(-10, 'Negative amount');

      expect(result).toBeUndefined();
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should handle decimal precision correctly', async () => {
      const mockBalance = {
        balance: '100.5678',
        isUnlimited: false,
        userId: mockUserId,
      };

      let capturedNewBalance: string | undefined;
      let capturedAmount: string | undefined;

      const mockTransaction = vi.fn(async (callback) => {
        const mockTx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue(mockBalance),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn((values: any) => {
              capturedNewBalance = values.balance;
              return {
                where: vi.fn().mockResolvedValue(undefined),
              };
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn((values: any) => {
              capturedAmount = values.amount;
              return Promise.resolve(undefined);
            }),
          }),
        };
        return callback(mockTx);
      });

      mockDb.transaction = mockTransaction as any;

      const result = await creditService.deductCredits(25.1234, 'Test precision');

      // Should return precise calculation
      expect(result).toBeCloseTo(75.4444, 4);

      // Should store with 4 decimal places
      expect(capturedNewBalance).toBe('75.4444');
      expect(capturedAmount).toBe('-25.1234');
    });

    it('should create transaction record with correct data', async () => {
      const mockBalance = {
        balance: '100.0000',
        isUnlimited: false,
        userId: mockUserId,
      };

      let capturedTransactionData: any;

      const mockTransaction = vi.fn(async (callback) => {
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
              capturedTransactionData = data;
              return Promise.resolve(undefined);
            }),
          }),
        };
        return callback(mockTx);
      });

      mockDb.transaction = mockTransaction as any;

      await creditService.deductCredits(25, 'Model usage', 'msg_123', {
        model: 'gpt-4',
        tokens: 1000,
      });

      expect(capturedTransactionData).toMatchObject({
        amount: '-25.0000',
        balanceAfter: '75.0000',
        category: 'CONSUMPTION',
        description: 'Model usage',
        id: 'tx_mock_id_123',
        metadata: {
          model: 'gpt-4',
          tokens: 1000,
        },
        refId: 'msg_123',
        type: 'CONSUMPTION',
        userId: mockUserId,
      });
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return true when balance exists and is greater than 0 with no estimate', async () => {
      const mockBalance = {
        balance: '50.0000',
        isUnlimited: false,
      };

      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(mockBalance as any);

      const result = await creditService.hasEnoughCredits();

      expect(result).toBe(true);
    });

    it('should return false when balance is not found', async () => {
      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(undefined);

      const result = await creditService.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when user has unlimited credits', async () => {
      const mockBalance = {
        balance: '0.0000',
        isUnlimited: true,
      };

      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(mockBalance as any);

      const result = await creditService.hasEnoughCredits(1000);

      expect(result).toBe(true);
    });

    it('should return true when balance is greater than estimated amount', async () => {
      const mockBalance = {
        balance: '100.0000',
        isUnlimited: false,
      };

      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(mockBalance as any);

      const result = await creditService.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should return true when balance equals estimated amount', async () => {
      const mockBalance = {
        balance: '50.0000',
        isUnlimited: false,
      };

      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(mockBalance as any);

      const result = await creditService.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should return false when balance is less than estimated amount', async () => {
      const mockBalance = {
        balance: '30.0000',
        isUnlimited: false,
      };

      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(mockBalance as any);

      const result = await creditService.hasEnoughCredits(50);

      expect(result).toBe(false);
    });

    it('should return false when balance is 0 with no estimate', async () => {
      const mockBalance = {
        balance: '0.0000',
        isUnlimited: false,
      };

      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(mockBalance as any);

      const result = await creditService.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when balance is positive with estimate of 0', async () => {
      const mockBalance = {
        balance: '10.0000',
        isUnlimited: false,
      };

      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(mockBalance as any);

      const result = await creditService.hasEnoughCredits(0);

      expect(result).toBe(true);
    });

    it('should handle negative balance correctly', async () => {
      const mockBalance = {
        balance: '-10.0000',
        isUnlimited: false,
      };

      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(mockBalance as any);

      const result = await creditService.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should handle decimal values correctly', async () => {
      const mockBalance = {
        balance: '50.5555',
        isUnlimited: false,
      };

      vi.mocked(mockDb.query.userBalances.findFirst).mockResolvedValue(mockBalance as any);

      const result = await creditService.hasEnoughCredits(50.5555);

      expect(result).toBe(true);
    });
  });

  describe('constructor', () => {
    it('should initialize with correct userId and database', () => {
      const service = new CreditService(mockDb, 'test_user_456');

      expect(service).toBeInstanceOf(CreditService);
      // Access private properties through type assertion for testing
      expect((service as any).userId).toBe('test_user_456');
      expect((service as any).db).toBe(mockDb);
    });
  });
});
