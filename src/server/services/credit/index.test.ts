import { LobeChatDatabase } from '@/database/type';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreditService } from './index';

// Mock console methods to avoid noise in test output
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('CreditService', () => {
  let service: CreditService;
  const mockUserId = 'test-user-123';
  let mockDB: LobeChatDatabase;
  let mockTransaction: any;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create mock database with query methods
    mockTransaction = {
      query: {
        userBalances: {
          findFirst: vi.fn(),
        },
      },
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
    };

    mockDB = {
      query: {
        modelPricings: {
          findFirst: vi.fn(),
        },
        userBalances: {
          findFirst: vi.fn(),
        },
      },
      transaction: vi.fn().mockImplementation((callback) => callback(mockTransaction)),
    } as unknown as LobeChatDatabase;

    service = new CreditService(mockDB, mockUserId);
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using their own API key', async () => {
      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);

      expect(cost).toBe(0);
      expect(console.log).toHaveBeenCalledWith(
        '[Credit] User using own config for openai, no charge',
      );
      expect(mockDB.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing is found for the model', async () => {
      vi.mocked(mockDB.query.modelPricings.findFirst).mockResolvedValue(undefined);

      const cost = await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);

      expect(cost).toBe(0);
      expect(console.warn).toHaveBeenCalledWith(
        '[Credit] No pricing found for unknown-provider::unknown-model, no charge',
      );
    });

    it('should calculate cost correctly with valid pricing', async () => {
      const mockPricing = {
        id: 'mp-123',
        model: 'gpt-4',
        provider: 'openai',
        inputPrice: '5.000000',
        outputPrice: '10.000000',
        userInputPrice: '10.000000', // $10 per 1M tokens
        userOutputPrice: '20.000000', // $20 per 1M tokens
        perRequestPrice: '0.001000', // $0.001 per request
        subProvider: null,
        memo: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        accessedAt: new Date('2024-01-01'),
      };

      vi.mocked(mockDB.query.modelPricings.findFirst).mockResolvedValue(mockPricing);

      // 1000 input tokens, 500 output tokens
      // Cost = (1000/1,000,000) * 10 + (500/1,000,000) * 20 + 0.001
      // Cost = 0.01 + 0.01 + 0.001 = 0.021
      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500);

      expect(cost).toBe(0.021);
      expect(console.log).toHaveBeenCalledWith(
        '[Credit] Charging for openai::gpt-4, cost: 0.0210 credits',
      );
    });

    it('should handle pricing with subProvider correctly', async () => {
      const mockPricing = {
        id: 'mp-124',
        model: 'deepseek/deepseek-chat-v3.1',
        provider: 'protochat',
        inputPrice: '2.500000',
        outputPrice: '7.500000',
        userInputPrice: '5.000000',
        userOutputPrice: '15.000000',
        perRequestPrice: '0.000000',
        subProvider: 'deepseek',
        memo: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        accessedAt: new Date('2024-01-01'),
      };

      vi.mocked(mockDB.query.modelPricings.findFirst).mockResolvedValue(mockPricing);

      const cost = await service.calculateCost(
        'deepseek/deepseek-chat-v3.1',
        'protochat',
        2000,
        1000,
      );

      // Cost = (2000/1,000,000) * 5 + (1000/1,000,000) * 15 + 0
      // Cost = 0.01 + 0.015 = 0.025
      expect(cost).toBe(0.025);
      expect(console.log).toHaveBeenCalledWith(
        '[Credit] Charging for protochat::deepseek/deepseek-chat-v3.1 (via deepseek), cost: 0.0250 credits',
      );
    });

    it('should handle zero tokens correctly', async () => {
      const mockPricing = {
        id: 'mp-125',
        model: 'gpt-4',
        provider: 'openai',
        inputPrice: '5.000000',
        outputPrice: '10.000000',
        userInputPrice: '10.000000',
        userOutputPrice: '20.000000',
        perRequestPrice: '0.001000',
        subProvider: null,
        memo: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        accessedAt: new Date('2024-01-01'),
      };

      vi.mocked(mockDB.query.modelPricings.findFirst).mockResolvedValue(mockPricing);

      const cost = await service.calculateCost('gpt-4', 'openai', 0, 0);

      // Cost = 0 + 0 + 0.001 = 0.001 (only per-request price)
      expect(cost).toBe(0.001);
    });

    it('should handle missing userInputPrice gracefully', async () => {
      const mockPricing = {
        id: 'mp-126',
        model: 'gpt-4',
        provider: 'openai',
        inputPrice: '5.000000',
        outputPrice: '10.000000',
        userInputPrice: '',
        userOutputPrice: '20.000000',
        perRequestPrice: '0.000000',
        subProvider: null,
        memo: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        accessedAt: new Date('2024-01-01'),
      };

      vi.mocked(mockDB.query.modelPricings.findFirst).mockResolvedValue(mockPricing);

      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500);

      // Cost = 0 + (500/1,000,000) * 20 + 0 = 0.01
      expect(cost).toBe(0.01);
    });

    it('should handle large token counts correctly', async () => {
      const mockPricing = {
        id: 'mp-127',
        model: 'gpt-4',
        provider: 'openai',
        inputPrice: '5.000000',
        outputPrice: '10.000000',
        userInputPrice: '10.000000',
        userOutputPrice: '20.000000',
        perRequestPrice: '0.000000',
        subProvider: null,
        memo: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        accessedAt: new Date('2024-01-01'),
      };

      vi.mocked(mockDB.query.modelPricings.findFirst).mockResolvedValue(mockPricing);

      // 10M input tokens, 5M output tokens
      const cost = await service.calculateCost('gpt-4', 'openai', 10_000_000, 5_000_000);

      // Cost = (10,000,000/1,000,000) * 10 + (5,000,000/1,000,000) * 20
      // Cost = 100 + 100 = 200
      expect(cost).toBe(200);
    });
  });

  describe('deductCredits', () => {
    it('should not deduct when amount is 0', async () => {
      const result = await service.deductCredits(0, 'Test deduction');

      expect(result).toBeUndefined();
      expect(mockDB.transaction).not.toHaveBeenCalled();
    });

    it('should not deduct when amount is negative', async () => {
      const result = await service.deductCredits(-10, 'Test deduction');

      expect(result).toBeUndefined();
      expect(mockDB.transaction).not.toHaveBeenCalled();
    });

    it('should successfully deduct credits from user balance', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '100.0000',
        isUnlimited: false,
      };

      vi.mocked(mockTransaction.query.userBalances.findFirst).mockResolvedValue(mockBalance);

      const result = await service.deductCredits(10.5, 'GPT-4 usage', 'msg-123');

      expect(mockTransaction.query.userBalances.findFirst).toHaveBeenCalled();
      expect(mockTransaction.update).toHaveBeenCalled();
      expect(mockTransaction.set).toHaveBeenCalledWith({
        balance: '89.5000',
        updatedAt: expect.any(Date),
      });
      expect(mockTransaction.insert).toHaveBeenCalled();
      expect(mockTransaction.values).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '-10.5000',
          balanceAfter: '89.5000',
          category: 'CONSUMPTION',
          description: 'GPT-4 usage',
          type: 'CONSUMPTION',
          userId: mockUserId,
          refId: 'msg-123',
        }),
      );
      expect(result).toBe(89.5);
    });

    it('should allow deduction for unlimited balance users', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '10.0000',
        isUnlimited: true,
      };

      vi.mocked(mockTransaction.query.userBalances.findFirst).mockResolvedValue(mockBalance);

      const result = await service.deductCredits(100, 'Large usage');

      expect(mockTransaction.update).toHaveBeenCalled();
      expect(mockTransaction.set).toHaveBeenCalledWith({
        balance: '-90.0000',
        updatedAt: expect.any(Date),
      });
      expect(result).toBe(-90);
    });

    it('should throw error when user balance is not found', async () => {
      vi.mocked(mockTransaction.query.userBalances.findFirst).mockResolvedValue(null);

      await expect(service.deductCredits(10, 'Test usage')).rejects.toThrow(
        'User balance not found',
      );

      expect(mockTransaction.update).not.toHaveBeenCalled();
      expect(mockTransaction.insert).not.toHaveBeenCalled();
    });

    it('should throw error when insufficient credits', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '5.0000',
        isUnlimited: false,
      };

      vi.mocked(mockTransaction.query.userBalances.findFirst).mockResolvedValue(mockBalance);

      await expect(service.deductCredits(10, 'Test usage')).rejects.toThrow('Insufficient credits');

      expect(mockTransaction.update).not.toHaveBeenCalled();
      expect(mockTransaction.insert).not.toHaveBeenCalled();
    });

    it('should handle exact balance deduction', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '10.0000',
        isUnlimited: false,
      };

      vi.mocked(mockTransaction.query.userBalances.findFirst).mockResolvedValue(mockBalance);

      const result = await service.deductCredits(10, 'Exact balance usage');

      expect(mockTransaction.set).toHaveBeenCalledWith({
        balance: '0.0000',
        updatedAt: expect.any(Date),
      });
      expect(result).toBe(0);
    });

    it('should store metadata in transaction record', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '100.0000',
        isUnlimited: false,
      };

      vi.mocked(mockTransaction.query.userBalances.findFirst).mockResolvedValue(mockBalance);

      const metadata = { model: 'gpt-4', tokens: 1000 };
      await service.deductCredits(5, 'AI usage', 'msg-456', metadata);

      expect(mockTransaction.values).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata,
          refId: 'msg-456',
        }),
      );
    });

    it('should handle small decimal amounts correctly', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '1.0000',
        isUnlimited: false,
      };

      vi.mocked(mockTransaction.query.userBalances.findFirst).mockResolvedValue(mockBalance);

      const result = await service.deductCredits(0.0001, 'Tiny usage');

      expect(mockTransaction.set).toHaveBeenCalledWith({
        balance: '0.9999',
        updatedAt: expect.any(Date),
      });
      expect(result).toBe(0.9999);
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when user balance is not found', async () => {
      vi.mocked(mockDB.query.userBalances.findFirst).mockResolvedValue(undefined);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when user has unlimited balance', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '0.0000',
        isUnlimited: true,
        totalPurchased: '0.0000',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        accessedAt: new Date('2024-01-01'),
      };

      vi.mocked(mockDB.query.userBalances.findFirst).mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(1000);

      expect(result).toBe(true);
    });

    it('should return true when balance is greater than 0 and no estimated amount', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '10.0000',
        isUnlimited: false,
        totalPurchased: '10.0000',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        accessedAt: new Date('2024-01-01'),
      };

      vi.mocked(mockDB.query.userBalances.findFirst).mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(true);
    });

    it('should return false when balance is 0 and no estimated amount', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '0.0000',
        isUnlimited: false,
        totalPurchased: '0.0000',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        accessedAt: new Date('2024-01-01'),
      };

      vi.mocked(mockDB.query.userBalances.findFirst).mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when balance is sufficient for estimated amount', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '100.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        accessedAt: new Date('2024-01-01'),
      };

      vi.mocked(mockDB.query.userBalances.findFirst).mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should return false when balance is insufficient for estimated amount', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '10.0000',
        isUnlimited: false,
        totalPurchased: '10.0000',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        accessedAt: new Date('2024-01-01'),
      };

      vi.mocked(mockDB.query.userBalances.findFirst).mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(false);
    });

    it('should return true when balance exactly equals estimated amount', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '50.0000',
        isUnlimited: false,
        totalPurchased: '50.0000',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        accessedAt: new Date('2024-01-01'),
      };

      vi.mocked(mockDB.query.userBalances.findFirst).mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should handle small decimal amounts correctly', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '0.0001',
        isUnlimited: false,
        totalPurchased: '1.0000',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        accessedAt: new Date('2024-01-01'),
      };

      vi.mocked(mockDB.query.userBalances.findFirst).mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(0.00005);

      expect(result).toBe(true);
    });

    it('should return false for negative balance when checking estimated amount', async () => {
      const mockBalance = {
        userId: mockUserId,
        balance: '-10.0000',
        isUnlimited: false,
        totalPurchased: '100.0000',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        accessedAt: new Date('2024-01-01'),
      };

      vi.mocked(mockDB.query.userBalances.findFirst).mockResolvedValue(mockBalance);

      const result = await service.hasEnoughCredits(5);

      expect(result).toBe(false);
    });
  });
});
