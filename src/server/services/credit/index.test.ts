import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LobeChatDatabase } from '@/database/type';

import { CreditService } from './index';

vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn().mockReturnValue('tx-mock-id'),
}));

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: Partial<LobeChatDatabase>;
  const userId = 'test-user-id';

  beforeEach(() => {
    mockDb = {
      query: {
        modelPricings: { findFirst: vi.fn() },
        userBalances: { findFirst: vi.fn() },
      } as any,
      transaction: vi.fn(),
    };

    service = new CreditService(mockDb as LobeChatDatabase, userId);
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using their own API key', async () => {
      const result = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);

      expect(result).toBe(0);
      expect((mockDb.query as any).modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing found for model', async () => {
      (mockDb.query as any).modelPricings.findFirst.mockResolvedValue(null);

      const result = await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);

      expect(result).toBe(0);
    });

    it('should calculate cost correctly based on token usage', async () => {
      (mockDb.query as any).modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10',
        userOutputPrice: '30',
        perRequestPrice: '0',
        subProvider: null,
      });

      // 1M input + 1M output tokens
      const result = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);

      expect(result).toBe(40); // (1 * 10) + (1 * 30)
    });

    it('should add per-request price to token cost', async () => {
      (mockDb.query as any).modelPricings.findFirst.mockResolvedValue({
        model: 'dall-e-3',
        provider: 'openai',
        userInputPrice: '0',
        userOutputPrice: '0',
        perRequestPrice: '0.04',
        subProvider: null,
      });

      const result = await service.calculateCost('dall-e-3', 'openai', 0, 0);

      expect(result).toBe(0.04);
    });

    it('should handle null pricing fields by defaulting to 0', async () => {
      (mockDb.query as any).modelPricings.findFirst.mockResolvedValue({
        model: 'test-model',
        provider: 'test',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
        subProvider: null,
      });

      const result = await service.calculateCost('test-model', 'test', 1_000_000, 1_000_000);

      expect(result).toBe(0);
    });

    it('should scale cost proportionally with partial token counts', async () => {
      (mockDb.query as any).modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10',
        userOutputPrice: '20',
        perRequestPrice: '0',
        subProvider: null,
      });

      // 100k input, 50k output
      const result = await service.calculateCost('gpt-4', 'openai', 100_000, 50_000);

      // (0.1 * 10) + (0.05 * 20) = 1 + 1 = 2
      expect(result).toBeCloseTo(2, 5);
    });

    it('should query pricing with correct model and provider', async () => {
      (mockDb.query as any).modelPricings.findFirst.mockResolvedValue(null);

      await service.calculateCost('deepseek/deepseek-chat-v3', 'protochat', 500, 250);

      expect((mockDb.query as any).modelPricings.findFirst).toHaveBeenCalledOnce();
    });

    it('should default isUserConfig to false when not provided', async () => {
      (mockDb.query as any).modelPricings.findFirst.mockResolvedValue(null);

      await service.calculateCost('gpt-4', 'openai', 100, 50);

      expect((mockDb.query as any).modelPricings.findFirst).toHaveBeenCalled();
    });
  });

  describe('deductCredits', () => {
    it('should not run transaction when amount is 0', async () => {
      await service.deductCredits(0, 'test charge');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should not run transaction when amount is negative', async () => {
      await service.deductCredits(-5, 'refund');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw when user balance record does not exist', async () => {
      (mockDb.transaction as any).mockImplementation(async (fn: (tx: any) => any) => {
        const mockTx = {
          query: { userBalances: { findFirst: vi.fn().mockResolvedValue(null) } },
        };
        return fn(mockTx);
      });

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('User balance not found');
    });

    it('should throw when user has insufficient credits', async () => {
      (mockDb.transaction as any).mockImplementation(async (fn: (tx: any) => any) => {
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
        return fn(mockTx);
      });

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('Insufficient credits');
    });

    it('should deduct credits and return new balance', async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      const mockValues = vi.fn().mockResolvedValue(undefined);
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      (mockDb.transaction as any).mockImplementation(async (fn: (tx: any) => any) => {
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

      const result = await service.deductCredits(10, 'chat completion', 'ref-123');

      expect(result).toBeCloseTo(90, 4);
    });

    it('should allow deduction when balance is unlimited even with zero balance', async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      const mockValues = vi.fn().mockResolvedValue(undefined);
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

      (mockDb.transaction as any).mockImplementation(async (fn: (tx: any) => any) => {
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
        return fn(mockTx);
      });

      await expect(service.deductCredits(10_000, 'unlimited user')).resolves.not.toThrow();
    });

    it('should insert a CONSUMPTION transaction record', async () => {
      const mockValues = vi.fn().mockResolvedValue(undefined);
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

      (mockDb.transaction as any).mockImplementation(async (fn: (tx: any) => any) => {
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
          update: mockUpdate,
          insert: mockInsert,
        };
        return fn(mockTx);
      });

      await service.deductCredits(5, 'test description', undefined, { model: 'gpt-4' });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'CONSUMPTION',
          type: 'CONSUMPTION',
          description: 'test description',
          userId,
        }),
      );
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return false when no balance record exists', async () => {
      (mockDb.query as any).userBalances.findFirst.mockResolvedValue(null);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when balance is unlimited regardless of amount', async () => {
      (mockDb.query as any).userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: true,
      });

      const result = await service.hasEnoughCredits(1000);

      expect(result).toBe(true);
    });

    it('should return true when balance exceeds estimated amount', async () => {
      (mockDb.query as any).userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '100.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should return true when balance equals estimated amount exactly', async () => {
      (mockDb.query as any).userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '50.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should return false when balance is less than estimated amount', async () => {
      (mockDb.query as any).userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '10.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(50);

      expect(result).toBe(false);
    });

    it('should return true when no amount given and balance is positive', async () => {
      (mockDb.query as any).userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0.0001',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits();

      expect(result).toBe(true);
    });

    it('should return false when no amount given and balance is zero', async () => {
      (mockDb.query as any).userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '0.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return false when no amount given and balance is negative', async () => {
      (mockDb.query as any).userBalances.findFirst.mockResolvedValue({
        userId,
        balance: '-5.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });
  });
});
