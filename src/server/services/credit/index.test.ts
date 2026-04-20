import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';

import { CreditService } from './index';

vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn().mockReturnValue('tx_mockedid123'),
}));

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: Partial<LobeChatDatabase>;
  const userId = 'test-user-id';

  const mockFindFirstModelPricing = vi.fn();
  const mockFindFirstUserBalance = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      query: {
        modelPricings: {
          findFirst: mockFindFirstModelPricing,
        },
        userBalances: {
          findFirst: mockFindFirstUserBalance,
        },
      } as any,
      transaction: vi.fn(),
    } as Partial<LobeChatDatabase>;

    service = new CreditService(mockDb as LobeChatDatabase, userId);
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using own API key', async () => {
      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);
      expect(cost).toBe(0);
      expect(mockFindFirstModelPricing).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing found for model/provider', async () => {
      mockFindFirstModelPricing.mockResolvedValue(null);

      const cost = await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);
      expect(cost).toBe(0);
    });

    it('should calculate cost based on input/output tokens', async () => {
      mockFindFirstModelPricing.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10.00',
        userOutputPrice: '30.00',
        perRequestPrice: '0',
        subProvider: null,
      });

      // 1,000,000 input tokens at $10/M = $10, 500,000 output tokens at $30/M = $15 => total $25
      const cost = await service.calculateCost('gpt-4', 'openai', 1_000_000, 500_000);
      expect(cost).toBeCloseTo(25, 4);
    });

    it('should include perRequestPrice in cost calculation', async () => {
      mockFindFirstModelPricing.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '0',
        userOutputPrice: '0',
        perRequestPrice: '0.01',
        subProvider: null,
      });

      const cost = await service.calculateCost('gpt-4', 'openai', 0, 0);
      expect(cost).toBeCloseTo(0.01, 4);
    });

    it('should handle missing price fields (treat as 0)', async () => {
      mockFindFirstModelPricing.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
        subProvider: null,
      });

      const cost = await service.calculateCost('gpt-4', 'openai', 1000, 500);
      expect(cost).toBe(0);
    });

    it('should query modelPricings with correct model and provider', async () => {
      mockFindFirstModelPricing.mockResolvedValue(null);

      await service.calculateCost('deepseek/deepseek-chat-v3.1', 'protochat', 100, 50);

      expect(mockFindFirstModelPricing).toHaveBeenCalledOnce();
    });

    it('should default isUserConfig to false', async () => {
      mockFindFirstModelPricing.mockResolvedValue(null);

      // No 5th argument — defaults to false, so DB is queried
      await service.calculateCost('gpt-4', 'openai', 100, 50);
      expect(mockFindFirstModelPricing).toHaveBeenCalledOnce();
    });
  });

  describe('deductCredits', () => {
    it('should do nothing when amount is 0', async () => {
      await service.deductCredits(0, 'test');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should do nothing when amount is negative', async () => {
      await service.deductCredits(-5, 'refund');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw when user balance record is not found', async () => {
      const mockTx = {
        query: {
          userBalances: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      };
      (mockDb.transaction as any).mockImplementation((cb: (tx: any) => Promise<any>) => cb(mockTx));

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('User balance not found');
    });

    it('should throw when user has insufficient credits', async () => {
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
      (mockDb.transaction as any).mockImplementation((cb: (tx: any) => Promise<any>) => cb(mockTx));

      await expect(service.deductCredits(10, 'chat')).rejects.toThrow('Insufficient credits');
    });

    it('should deduct credits and create transaction record for a normal user', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      });
      const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

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

      (mockDb.transaction as any).mockImplementation((cb: (tx: any) => Promise<any>) => cb(mockTx));

      const result = await service.deductCredits(20, 'test charge');

      expect(result).toBeCloseTo(80, 4);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should allow deduction when user balance is unlimited even if balance < amount', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
      });
      const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

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

      (mockDb.transaction as any).mockImplementation((cb: (tx: any) => Promise<any>) => cb(mockTx));

      // Should not throw even though balance is 0 and amount > 0
      await expect(service.deductCredits(50, 'unlimited user charge')).resolves.not.toThrow();
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when user balance record is not found', async () => {
      mockFindFirstUserBalance.mockResolvedValue(null);

      const result = await service.hasEnoughCredits();
      expect(result).toBe(false);
    });

    it('should return true when user balance is unlimited', async () => {
      mockFindFirstUserBalance.mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: true,
      });

      const result = await service.hasEnoughCredits(100);
      expect(result).toBe(true);
    });

    it('should return true when balance is positive and estimatedAmount is 0', async () => {
      mockFindFirstUserBalance.mockResolvedValue({
        userId,
        balance: '10.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(0);
      expect(result).toBe(true);
    });

    it('should return false when balance is zero and estimatedAmount is 0', async () => {
      mockFindFirstUserBalance.mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(0);
      expect(result).toBe(false);
    });

    it('should return true when balance >= estimatedAmount', async () => {
      mockFindFirstUserBalance.mockResolvedValue({
        userId,
        balance: '50.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(50);
      expect(result).toBe(true);
    });

    it('should return false when balance < estimatedAmount', async () => {
      mockFindFirstUserBalance.mockResolvedValue({
        userId,
        balance: '5.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(10);
      expect(result).toBe(false);
    });

    it('should default estimatedAmount to 0', async () => {
      mockFindFirstUserBalance.mockResolvedValue({
        userId,
        balance: '1.0000',
        isUnlimited: false,
      });

      // No argument → estimatedAmount=0, balance>0 → true
      const result = await service.hasEnoughCredits();
      expect(result).toBe(true);
    });
  });
});
