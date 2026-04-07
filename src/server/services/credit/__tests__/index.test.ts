import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CreditService } from '../index';

vi.mock('@/database/utils/idGenerator', () => ({
  idGenerator: vi.fn(() => 'tx_test123'),
}));

describe('CreditService', () => {
  let service: CreditService;
  let mockDb: any;
  const mockUserId = 'user-123';

  let consoleLogSpy: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockDb = {
      query: {
        modelPricings: { findFirst: vi.fn() },
        userBalances: { findFirst: vi.fn() },
      },
      transaction: vi.fn(),
    };

    service = new CreditService(mockDb, mockUserId);
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleLogSpy?.mockRestore();
    consoleWarnSpy?.mockRestore();
  });

  // ---------------------------------------------------------------------------
  // calculateCost
  // ---------------------------------------------------------------------------
  describe('calculateCost', () => {
    it('should return 0 when isUserConfig is true', async () => {
      const result = await service.calculateCost('gpt-4', 'openai', 1000, 500, true);

      expect(result).toBe(0);
      expect(mockDb.query.modelPricings.findFirst).not.toHaveBeenCalled();
    });

    it('should return 0 when no pricing found for model+provider', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue(undefined);

      const result = await service.calculateCost('unknown-model', 'unknown-provider', 1000, 500);

      expect(result).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No pricing found'),
      );
    });

    it('should calculate cost correctly using userInputPrice and userOutputPrice', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10', // 10 credits per 1M tokens
        userOutputPrice: '30', // 30 credits per 1M tokens
        perRequestPrice: '0',
        subProvider: null,
      });

      // 1,000,000 input tokens + 1,000,000 output tokens → 10 + 30 = 40
      const result = await service.calculateCost('gpt-4', 'openai', 1_000_000, 1_000_000);

      expect(result).toBeCloseTo(40, 4);
    });

    it('should include perRequestPrice in the total cost', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '0',
        userOutputPrice: '0',
        perRequestPrice: '5',
        subProvider: null,
      });

      const result = await service.calculateCost('gpt-4', 'openai', 100, 100);

      expect(result).toBeCloseTo(5, 4);
    });

    it('should handle missing price fields gracefully (treat as 0)', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: null,
        userOutputPrice: null,
        perRequestPrice: null,
        subProvider: null,
      });

      const result = await service.calculateCost('gpt-4', 'openai', 1000, 500);

      expect(result).toBe(0);
    });

    it('should calculate partial token costs correctly', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'claude-3',
        provider: 'anthropic',
        userInputPrice: '6',  // 6 credits per 1M tokens
        userOutputPrice: '18', // 18 credits per 1M tokens
        perRequestPrice: '0',
        subProvider: null,
      });

      // 500,000 input → 3 credits; 200,000 output → 3.6 credits
      const result = await service.calculateCost('claude-3', 'anthropic', 500_000, 200_000);

      expect(result).toBeCloseTo(6.6, 4);
    });

    it('should log subProvider info when present', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'protochat',
        userInputPrice: '10',
        userOutputPrice: '30',
        perRequestPrice: '0',
        subProvider: 'openai',
      });

      await service.calculateCost('gpt-4', 'protochat', 1000, 500);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('via openai'));
    });

    it('should default isUserConfig to false and charge normally', async () => {
      mockDb.query.modelPricings.findFirst.mockResolvedValue({
        model: 'gpt-4',
        provider: 'openai',
        userInputPrice: '10',
        userOutputPrice: '30',
        perRequestPrice: '0',
        subProvider: null,
      });

      // Not passing isUserConfig → default false → should charge
      const result = await service.calculateCost('gpt-4', 'openai', 1_000_000, 0);

      expect(result).toBeCloseTo(10, 4);
    });
  });

  // ---------------------------------------------------------------------------
  // deductCredits
  // ---------------------------------------------------------------------------
  describe('deductCredits', () => {
    it('should return early without transaction when amount is 0', async () => {
      await service.deductCredits(0, 'free call');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should return early without transaction when amount is negative', async () => {
      await service.deductCredits(-5, 'negative amount');

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw an error when user balance is not found', async () => {
      mockDb.transaction.mockImplementation(async (fn: any) => {
        const tx = {
          query: { userBalances: { findFirst: vi.fn().mockResolvedValue(null) } },
          update: vi.fn(),
          insert: vi.fn(),
        };
        return fn(tx);
      });

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('User balance not found');
    });

    it('should throw an error when user has insufficient credits', async () => {
      mockDb.transaction.mockImplementation(async (fn: any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId: mockUserId,
                balance: '5.0000',
                isUnlimited: false,
              }),
            },
          },
          update: vi.fn(),
          insert: vi.fn(),
        };
        return fn(tx);
      });

      await expect(service.deductCredits(10, 'test')).rejects.toThrow('Insufficient credits');
    });

    it('should successfully deduct credits and create transaction record', async () => {
      const mockUpdate = vi.fn().mockReturnValue({ where: vi.fn() });
      const mockInsert = vi.fn().mockReturnValue({ values: vi.fn() });

      mockDb.transaction.mockImplementation(async (fn: any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId: mockUserId,
                balance: '100.0000',
                isUnlimited: false,
              }),
            },
          },
          update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) }),
          insert: vi.fn().mockReturnValue({ values: vi.fn() }),
        };
        return fn(tx);
      });

      const result = await service.deductCredits(25, 'chat completion', 'msg-1');

      expect(result).toBeCloseTo(75, 4);
    });

    it('should allow deduction when balance isUnlimited even if balance string is low', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn() }),
      });
      const mockInsert = vi.fn().mockReturnValue({ values: vi.fn() });

      mockDb.transaction.mockImplementation(async (fn: any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId: mockUserId,
                balance: '0.0000',
                isUnlimited: true,
              }),
            },
          },
          update: mockUpdate,
          insert: mockInsert,
        };
        return fn(tx);
      });

      // Should not throw even with 0 balance because isUnlimited = true
      await expect(service.deductCredits(50, 'unlimited user charge')).resolves.not.toThrow();
    });

    it('should pass metadata and refId to the transaction record', async () => {
      const insertValuesMock = vi.fn();

      mockDb.transaction.mockImplementation(async (fn: any) => {
        const tx = {
          query: {
            userBalances: {
              findFirst: vi.fn().mockResolvedValue({
                userId: mockUserId,
                balance: '100.0000',
                isUnlimited: false,
              }),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({ where: vi.fn() }),
          }),
          insert: vi.fn().mockReturnValue({ values: insertValuesMock }),
        };
        return fn(tx);
      });

      const meta = { model: 'gpt-4', tokens: 1000 };
      await service.deductCredits(10, 'test deduction', 'ref-abc', meta);

      expect(insertValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'test deduction',
          refId: 'ref-abc',
          metadata: meta,
          category: 'CONSUMPTION',
          type: 'CONSUMPTION',
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // hasEnoughCredits
  // ---------------------------------------------------------------------------
  describe('hasEnoughCredits', () => {
    it('should return false when user balance record not found', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue(null);

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when user has unlimited balance', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId: mockUserId,
        balance: '0.0000',
        isUnlimited: true,
      });

      const result = await service.hasEnoughCredits(999);

      expect(result).toBe(true);
    });

    it('should return true when balance > 0 and no estimatedAmount provided', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId: mockUserId,
        balance: '50.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits();

      expect(result).toBe(true);
    });

    it('should return false when balance is 0 and no estimatedAmount provided', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId: mockUserId,
        balance: '0.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits();

      expect(result).toBe(false);
    });

    it('should return true when balance >= estimatedAmount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId: mockUserId,
        balance: '10.0000',
        isUnlimited: false,
      });

      expect(await service.hasEnoughCredits(10)).toBe(true);
      expect(await service.hasEnoughCredits(9.9999)).toBe(true);
    });

    it('should return false when balance < estimatedAmount', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId: mockUserId,
        balance: '5.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(10);

      expect(result).toBe(false);
    });

    it('should return true when estimatedAmount is 0 and balance > 0', async () => {
      mockDb.query.userBalances.findFirst.mockResolvedValue({
        userId: mockUserId,
        balance: '1.0000',
        isUnlimited: false,
      });

      const result = await service.hasEnoughCredits(0);

      expect(result).toBe(true);
    });
  });
});
