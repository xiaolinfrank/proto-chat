import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';

import { CreditService } from './index';

vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn().mockReturnValue('tx_mockid123456'),
}));

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: Partial<LobeChatDatabase>;
  const userId = 'test-user-123';

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      query: {
        modelPricings: { findFirst: vi.fn() },
        userBalances: { findFirst: vi.fn() },
      } as any,
      transaction: vi.fn(),
      update: vi.fn(),
      insert: vi.fn(),
    };

    service = new CreditService(mockDb as LobeChatDatabase, userId);
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using own API key', async () => {
      const result = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);
      expect(result).toBe(0);
      expect(mockDb.query!.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing found for model/provider', async () => {
      vi.mocked(mockDb.query!.modelPricings.findFirst).mockResolvedValue(undefined);

      const result = await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);
      expect(result).toBe(0);
    });

    it('should calculate cost correctly with input and output tokens', async () => {
      vi.mocked(mockDb.query!.modelPricings.findFirst).mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10',
        userOutputPrice: '30',
        perRequestPrice: '0',
        subProvider: null,
      } as any);

      // 1,000,000 input tokens * $10/M + 500,000 output tokens * $30/M = 10 + 15 = 25
      const result = await service.calculateCost('gpt-4', 'openai', 1_000_000, 500_000);
      expect(result).toBe(25);
    });

    it('should include per-request price in cost calculation', async () => {
      vi.mocked(mockDb.query!.modelPricings.findFirst).mockResolvedValue({
        model: 'claude-3',
        provider: 'anthropic',
        userInputPrice: '0',
        userOutputPrice: '0',
        perRequestPrice: '0.5',
        subProvider: null,
      } as any);

      const result = await service.calculateCost('claude-3', 'anthropic', 0, 0);
      expect(result).toBe(0.5);
    });

    it('should handle zero token counts', async () => {
      vi.mocked(mockDb.query!.modelPricings.findFirst).mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10',
        userOutputPrice: '30',
        perRequestPrice: '0',
        subProvider: null,
      } as any);

      const result = await service.calculateCost('gpt-4', 'openai', 0, 0);
      expect(result).toBe(0);
    });

    it('should handle null/undefined price fields as 0', async () => {
      vi.mocked(mockDb.query!.modelPricings.findFirst).mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
        subProvider: null,
      } as any);

      const result = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);
      expect(result).toBe(0);
    });

    it('should default isUserConfig to false when not provided', async () => {
      vi.mocked(mockDb.query!.modelPricings.findFirst).mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '1',
        userOutputPrice: '2',
        perRequestPrice: '0',
        subProvider: null,
      } as any);

      const result = await service.calculateCost('gpt-4', 'openai', 1_000_000, 0);
      expect(result).toBe(1);
    });

    it('should combine all cost components correctly', async () => {
      vi.mocked(mockDb.query!.modelPricings.findFirst).mockResolvedValue({
        model: 'deepseek-v3',
        provider: 'protochat',
        userInputPrice: '2',
        userOutputPrice: '4',
        perRequestPrice: '0.1',
        subProvider: 'deepseek',
      } as any);

      // 100k input tokens: (100000/1000000)*2 = 0.2
      // 200k output tokens: (200000/1000000)*4 = 0.8
      // per request: 0.1
      // total: 1.1
      const result = await service.calculateCost('deepseek-v3', 'protochat', 100_000, 200_000);
      expect(result).toBeCloseTo(1.1, 5);
    });
  });

  describe('deductCredits', () => {
    const setupTransactionMock = (balanceData: any) => {
      const mockTx = {
        query: {
          userBalances: { findFirst: vi.fn().mockResolvedValue(balanceData) },
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
      vi.mocked(mockDb.transaction!).mockImplementation((cb: any) => cb(mockTx));
      return mockTx;
    };

    it('should return early without transaction when amount is 0', async () => {
      await service.deductCredits(0, 'test description');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should return early without transaction when amount is negative', async () => {
      await service.deductCredits(-5, 'test description');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw error when user balance not found', async () => {
      const mockTx = {
        query: {
          userBalances: { findFirst: vi.fn().mockResolvedValue(undefined) },
        },
      };
      vi.mocked(mockDb.transaction!).mockImplementation((cb: any) => cb(mockTx));

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('User balance not found');
    });

    it('should throw error when balance is insufficient', async () => {
      setupTransactionMock({
        userId,
        balance: '5.0000',
        isUnlimited: false,
      });

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('Insufficient credits');
    });

    it('should deduct credits and return new balance for regular user', async () => {
      const mockTx = setupTransactionMock({
        userId,
        balance: '100.0000',
        isUnlimited: false,
      });

      const newBalance = await service.deductCredits(25.5, 'model usage', 'msg-123');

      expect(newBalance).toBeCloseTo(74.5, 4);
      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalled();
    });

    it('should allow deduction for unlimited user even with low balance', async () => {
      const mockTx = setupTransactionMock({
        userId,
        balance: '0.0000',
        isUnlimited: true,
      });

      const newBalance = await service.deductCredits(999, 'unlimited usage');

      expect(newBalance).toBeCloseTo(-999, 4);
      expect(mockTx.update).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalled();
    });

    it('should insert transaction with correct fields', async () => {
      const mockTx = setupTransactionMock({
        userId,
        balance: '50.0000',
        isUnlimited: false,
      });

      await service.deductCredits(10, 'test description', 'ref-456', { model: 'gpt-4' });

      const insertCall = mockTx.insert.mock.calls[0];
      expect(insertCall).toBeDefined();
      const valuesCall = mockTx.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(valuesCall).toMatchObject({
        amount: '-10.0000',
        balanceAfter: '40.0000',
        category: 'CONSUMPTION',
        description: 'test description',
        refId: 'ref-456',
        type: 'CONSUMPTION',
        userId,
        metadata: { model: 'gpt-4' },
      });
    });

    it('should format balance with 4 decimal places', async () => {
      const mockTx = setupTransactionMock({
        userId,
        balance: '10.1234',
        isUnlimited: false,
      });

      await service.deductCredits(1.5678, 'test');

      const valuesCall = mockTx.insert.mock.results[0].value.values.mock.calls[0][0];
      expect(valuesCall.amount).toBe('-1.5678');
      expect(valuesCall.balanceAfter).toBe('8.5556');
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when user balance not found', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue(undefined);

      const result = await service.hasEnoughCredits();
      expect(result).toBe(false);
    });

    it('should return true for unlimited users regardless of balance', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: true,
      } as any);

      const result = await service.hasEnoughCredits(9999);
      expect(result).toBe(true);
    });

    it('should return true when balance is positive and no estimated amount given', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '5.0000',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits();
      expect(result).toBe(true);
    });

    it('should return false when balance is zero and no estimated amount given', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits();
      expect(result).toBe(false);
    });

    it('should return true when balance equals estimated amount', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '10.0000',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits(10);
      expect(result).toBe(true);
    });

    it('should return false when balance is less than estimated amount', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '5.0000',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits(10);
      expect(result).toBe(false);
    });

    it('should return true when balance exceeds estimated amount', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '100.0000',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits(50);
      expect(result).toBe(true);
    });

    it('should handle estimatedAmount of 0 correctly', async () => {
      vi.mocked(mockDb.query!.userBalances.findFirst).mockResolvedValue({
        userId,
        balance: '1.0000',
        isUnlimited: false,
      } as any);

      const result = await service.hasEnoughCredits(0);
      expect(result).toBe(true);
    });
  });
});
