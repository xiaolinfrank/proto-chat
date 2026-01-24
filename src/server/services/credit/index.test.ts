import { LobeChatDatabase } from '@/database/type';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreditService } from './index';

// Mock console methods to avoid pollution
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

let service: CreditService;
const mockUserId = 'test-user-id';
let mockDB: any;
let mockTransaction: any;

// Mock pricing data
const mockPricing = {
  id: 'pricing-1',
  model: 'deepseek/deepseek-chat-v3.1',
  provider: 'protochat',
  subProvider: null,
  userInputPrice: '0.5',
  userOutputPrice: '1.0',
  perRequestPrice: '0.001',
};

const mockPricingWithSubProvider = {
  ...mockPricing,
  subProvider: 'openai',
};

// Mock balance data
const mockBalance = {
  id: 'balance-1',
  userId: mockUserId,
  balance: '100.0000',
  isUnlimited: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUnlimitedBalance = {
  ...mockBalance,
  isUnlimited: true,
};

beforeEach(() => {
  vi.clearAllMocks();

  // Setup mock transaction
  mockTransaction = {
    query: {
      userBalances: {
        findFirst: vi.fn(),
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

  // Setup mock database
  mockDB = {
    query: {
      modelPricings: {
        findFirst: vi.fn(),
      },
      userBalances: {
        findFirst: vi.fn(),
      },
    },
    transaction: vi.fn((callback) => callback(mockTransaction)),
  } as unknown as LobeChatDatabase;

  service = new CreditService(mockDB, mockUserId);
});

describe('CreditService', () => {
  describe('calculateCost', () => {
    it('should return 0 when isUserConfig is true', async () => {
      const cost = await service.calculateCost(
        'deepseek/deepseek-chat-v3.1',
        'protochat',
        1000,
        2000,
        true,
      );

      expect(cost).toBe(0);
      expect(mockDB.query.modelPricings.findFirst).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        '[Credit] User using own config for protochat, no charge',
      );
    });

    it('should return 0 when pricing is not found', async () => {
      mockDB.query.modelPricings.findFirst.mockResolvedValue(null);

      const cost = await service.calculateCost(
        'unknown/unknown-model',
        'unknown-provider',
        1000,
        2000,
      );

      expect(cost).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        '[Credit] No pricing found for unknown-provider::unknown/unknown-model, no charge',
      );
    });

    it('should calculate cost correctly with valid pricing', async () => {
      mockDB.query.modelPricings.findFirst.mockResolvedValue(mockPricing);

      // Input: 1,000,000 tokens, Output: 2,000,000 tokens
      // Cost = (1,000,000 / 1,000,000) * 0.5 + (2,000,000 / 1,000,000) * 1.0 + 0.001
      // Cost = 1 * 0.5 + 2 * 1.0 + 0.001 = 0.5 + 2.0 + 0.001 = 2.501
      const cost = await service.calculateCost(
        'deepseek/deepseek-chat-v3.1',
        'protochat',
        1_000_000,
        2_000_000,
      );

      expect(cost).toBe(2.501);
      expect(mockDB.query.modelPricings.findFirst).toHaveBeenCalledWith({
        where: expect.anything(),
      });
    });

    it('should calculate cost with sub-provider info logged', async () => {
      mockDB.query.modelPricings.findFirst.mockResolvedValue(mockPricingWithSubProvider);

      const cost = await service.calculateCost(
        'deepseek/deepseek-chat-v3.1',
        'protochat',
        500_000,
        1_000_000,
      );

      // Cost = (500,000 / 1,000,000) * 0.5 + (1,000,000 / 1,000,000) * 1.0 + 0.001
      // Cost = 0.5 * 0.5 + 1 * 1.0 + 0.001 = 0.25 + 1.0 + 0.001 = 1.251
      expect(cost).toBe(1.251);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('(via openai)'),
      );
    });

    it('should handle zero tokens', async () => {
      mockDB.query.modelPricings.findFirst.mockResolvedValue(mockPricing);

      const cost = await service.calculateCost(
        'deepseek/deepseek-chat-v3.1',
        'protochat',
        0,
        0,
      );

      // Cost = (0 / 1,000,000) * 0.5 + (0 / 1,000,000) * 1.0 + 0.001 = 0.001
      expect(cost).toBe(0.001);
    });

    it('should handle pricing with null price values', async () => {
      const pricingWithNulls = {
        ...mockPricing,
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
      };
      mockDB.query.modelPricings.findFirst.mockResolvedValue(pricingWithNulls);

      const cost = await service.calculateCost(
        'deepseek/deepseek-chat-v3.1',
        'protochat',
        1_000_000,
        2_000_000,
      );

      expect(cost).toBe(0);
    });

    it('should handle small token amounts correctly', async () => {
      mockDB.query.modelPricings.findFirst.mockResolvedValue(mockPricing);

      // Small amounts: 100 input tokens, 200 output tokens
      const cost = await service.calculateCost(
        'deepseek/deepseek-chat-v3.1',
        'protochat',
        100,
        200,
      );

      // Cost = (100 / 1,000,000) * 0.5 + (200 / 1,000,000) * 1.0 + 0.001
      // Cost = 0.00005 + 0.0002 + 0.001 = 0.00125
      expect(cost).toBe(0.00125);
    });
  });

  describe('deductCredits', () => {
    it('should not deduct when amount is 0', async () => {
      await service.deductCredits(0, 'Test transaction');

      expect(mockDB.transaction).not.toHaveBeenCalled();
    });

    it('should not deduct when amount is negative', async () => {
      await service.deductCredits(-10, 'Test transaction');

      expect(mockDB.transaction).not.toHaveBeenCalled();
    });

    it('should deduct credits successfully with sufficient balance', async () => {
      mockTransaction.query.userBalances.findFirst.mockResolvedValue(mockBalance);

      const result = await service.deductCredits(25.5, 'API call', 'ref-123', {
        model: 'test-model',
      });

      expect(mockDB.transaction).toHaveBeenCalled();
      expect(mockTransaction.query.userBalances.findFirst).toHaveBeenCalledWith({
        where: expect.anything(),
      });

      // Verify balance update
      const updateCall = mockTransaction.update.mock.results[0].value.set;
      expect(updateCall).toHaveBeenCalledWith({
        balance: '74.5000',
        updatedAt: expect.any(Date),
      });

      // Verify transaction insertion
      const insertCall = mockTransaction.insert.mock.results[0].value.values;
      expect(insertCall).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '-25.5000',
          balanceAfter: '74.5000',
          category: 'CONSUMPTION',
          description: 'API call',
          refId: 'ref-123',
          type: 'CONSUMPTION',
          userId: mockUserId,
          metadata: { model: 'test-model' },
        }),
      );

      expect(result).toBe(74.5);
    });

    it('should throw error when balance is not found', async () => {
      mockTransaction.query.userBalances.findFirst.mockResolvedValue(null);

      await expect(service.deductCredits(10, 'Test transaction')).rejects.toThrow(
        'User balance not found',
      );
    });

    it('should throw error when insufficient credits', async () => {
      const lowBalance = { ...mockBalance, balance: '5.0000' };
      mockTransaction.query.userBalances.findFirst.mockResolvedValue(lowBalance);

      await expect(service.deductCredits(10, 'Test transaction')).rejects.toThrow(
        'Insufficient credits',
      );
    });

    it('should allow deduction for unlimited accounts even with low balance', async () => {
      mockTransaction.query.userBalances.findFirst.mockResolvedValue(mockUnlimitedBalance);

      const result = await service.deductCredits(1000, 'Large API call');

      expect(result).toBe(-900); // 100 - 1000 = -900
      expect(mockDB.transaction).toHaveBeenCalled();
    });

    it('should handle deduction at exact balance', async () => {
      const exactBalance = { ...mockBalance, balance: '50.0000' };
      mockTransaction.query.userBalances.findFirst.mockResolvedValue(exactBalance);

      const result = await service.deductCredits(50, 'Exact deduction');

      expect(result).toBe(0);
      const updateCall = mockTransaction.update.mock.results[0].value.set;
      expect(updateCall).toHaveBeenCalledWith({
        balance: '0.0000',
        updatedAt: expect.any(Date),
      });
    });

    it('should handle very small amounts with precision', async () => {
      mockTransaction.query.userBalances.findFirst.mockResolvedValue(mockBalance);

      const result = await service.deductCredits(0.0001, 'Tiny transaction');

      expect(result).toBeCloseTo(99.9999, 4);
      const updateCall = mockTransaction.update.mock.results[0].value.set;
      expect(updateCall).toHaveBeenCalledWith({
        balance: '99.9999',
        updatedAt: expect.any(Date),
      });
    });

    it('should create transaction record with all fields', async () => {
      mockTransaction.query.userBalances.findFirst.mockResolvedValue(mockBalance);

      await service.deductCredits(10, 'Test description', 'ref-456', {
        provider: 'test-provider',
        model: 'test-model',
        tokens: 1000,
      });

      const insertCall = mockTransaction.insert.mock.results[0].value.values;
      expect(insertCall).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '-10.0000',
          balanceAfter: '90.0000',
          category: 'CONSUMPTION',
          description: 'Test description',
          refId: 'ref-456',
          type: 'CONSUMPTION',
          userId: mockUserId,
          metadata: {
            provider: 'test-provider',
            model: 'test-model',
            tokens: 1000,
          },
          id: expect.stringMatching(/^tx/),
        }),
      );
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when balance is not found', async () => {
      mockDB.query.userBalances.findFirst.mockResolvedValue(null);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true for unlimited accounts', async () => {
      mockDB.query.userBalances.findFirst.mockResolvedValue(mockUnlimitedBalance);

      const result = await service.hasEnoughCredits(1000);

      expect(result).toBe(true);
    });

    it('should return true when balance is greater than 0 with no estimated amount', async () => {
      mockDB.query.userBalances.findFirst.mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(true);
    });

    it('should return false when balance is 0 with no estimated amount', async () => {
      const zeroBalance = { ...mockBalance, balance: '0.0000' };
      mockDB.query.userBalances.findFirst.mockResolvedValue(zeroBalance);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when balance is sufficient for estimated amount', async () => {
      mockDB.query.userBalances.findFirst.mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should return false when balance is insufficient for estimated amount', async () => {
      mockDB.query.userBalances.findFirst.mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(150);

      expect(result).toBe(false);
    });

    it('should return true when balance exactly equals estimated amount', async () => {
      mockDB.query.userBalances.findFirst.mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(100);

      expect(result).toBe(true);
    });

    it('should handle very small balances', async () => {
      const smallBalance = { ...mockBalance, balance: '0.0001' };
      mockDB.query.userBalances.findFirst.mockResolvedValue(smallBalance);

      const resultWithNoEstimate = await service.hasEnoughCredits();
      expect(resultWithNoEstimate).toBe(true);

      const resultWithSmallEstimate = await service.hasEnoughCredits(0.00005);
      expect(resultWithSmallEstimate).toBe(true);

      const resultWithLargeEstimate = await service.hasEnoughCredits(0.0002);
      expect(resultWithLargeEstimate).toBe(false);
    });

    it('should handle estimated amount of 0', async () => {
      mockDB.query.userBalances.findFirst.mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(true); // Balance > 0, so should return true
    });

    it('should handle negative balance', async () => {
      const negativeBalance = { ...mockBalance, balance: '-10.0000' };
      mockDB.query.userBalances.findFirst.mockResolvedValue(negativeBalance);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });
  });
});
