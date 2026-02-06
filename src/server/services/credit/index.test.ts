import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { CreditService } from './index';
import { userBalances, userTransactions, modelPricings, users } from '@/database/schemas';
import { LobeChatDatabase } from '@/database/type';
import { getTestDB } from '@/database/models/__tests__/_util';

const userId = 'credit-service-test-user';
const otherUserId = 'credit-service-other-user';

const serverDB: LobeChatDatabase = await getTestDB();

describe('CreditService', () => {
  let creditService: CreditService;

  beforeEach(async () => {
    // Clean up test data
    await serverDB.delete(userTransactions);
    await serverDB.delete(userBalances);
    await serverDB.delete(modelPricings);
    await serverDB.delete(users);

    // Create test users
    await serverDB.insert(users).values([
      { id: userId, email: 'credit-test@example.com', fullName: 'Credit Test User' },
      { id: otherUserId, email: 'credit-other@example.com', fullName: 'Other User' },
    ]);

    // Create test user balance
    await serverDB.insert(userBalances).values({
      userId,
      balance: '100.0000',
      isUnlimited: false,
      totalPurchased: '100.0000',
    });

    creditService = new CreditService(serverDB, userId);
  });

  afterEach(async () => {
    // Clean up test data
    await serverDB.delete(userTransactions);
    await serverDB.delete(userBalances);
    await serverDB.delete(modelPricings);
    await serverDB.delete(users);
    vi.clearAllMocks();
  });

  describe('calculateCost', () => {
    it('should return 0 when user is using their own config', async () => {
      const cost = await creditService.calculateCost(
        'gpt-4',
        'openai',
        1000,
        500,
        true, // isUserConfig
      );

      expect(cost).toBe(0);
    });

    it('should return 0 when no pricing is found for the model', async () => {
      // Mock the query to return undefined without hitting the DB
      const spy = vi.spyOn(serverDB.query.modelPricings, 'findFirst').mockResolvedValue(undefined);

      const cost = await creditService.calculateCost(
        'non-existent-model',
        'openai',
        1000,
        500,
        false,
      );

      expect(cost).toBe(0);
      spy.mockRestore();
    });

    it('should calculate cost correctly with input and output tokens', async () => {
      // Mock pricing data
      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        inputPrice: '30.000000',
        outputPrice: '60.000000',
        userInputPrice: '36.000000',
        userOutputPrice: '72.000000',
        perRequestPrice: '0.000000',
        subProvider: null,
      };
      const spy = vi.spyOn(serverDB.query.modelPricings, 'findFirst').mockResolvedValue(mockPricing as any);

      // 1M input tokens + 500K output tokens
      const cost = await creditService.calculateCost('gpt-4', 'openai', 1_000_000, 500_000, false);

      // Expected: (1_000_000 / 1_000_000) * 36 + (500_000 / 1_000_000) * 72 = 36 + 36 = 72
      expect(cost).toBe(72);
      spy.mockRestore();
    });

    it('should calculate cost with per-request pricing', async () => {
      const mockPricing = {
        model: 'claude-3-opus',
        provider: 'anthropic',
        inputPrice: '15.000000',
        outputPrice: '75.000000',
        userInputPrice: '18.000000',
        userOutputPrice: '90.000000',
        perRequestPrice: '0.010000',
        subProvider: null,
      };
      const spy = vi.spyOn(serverDB.query.modelPricings, 'findFirst').mockResolvedValue(mockPricing as any);

      // 100K input tokens + 50K output tokens + per-request fee
      const cost = await creditService.calculateCost(
        'claude-3-opus',
        'anthropic',
        100_000,
        50_000,
        false,
      );

      // Expected: (100_000 / 1_000_000) * 18 + (50_000 / 1_000_000) * 90 + 0.01 = 1.8 + 4.5 + 0.01 = 6.31
      expect(cost).toBe(6.31);
      spy.mockRestore();
    });

    it('should handle zero tokens', async () => {
      const mockPricing = {
        model: 'gpt-3.5-turbo',
        provider: 'openai',
        inputPrice: '0.500000',
        outputPrice: '1.500000',
        userInputPrice: '0.600000',
        userOutputPrice: '1.800000',
        perRequestPrice: '0.000000',
        subProvider: null,
      };
      const spy = vi.spyOn(serverDB.query.modelPricings, 'findFirst').mockResolvedValue(mockPricing as any);

      const cost = await creditService.calculateCost('gpt-3.5-turbo', 'openai', 0, 0, false);

      expect(cost).toBe(0);
      spy.mockRestore();
    });

    it('should handle different providers', async () => {
      const mockPricing = {
        model: 'claude-3-sonnet',
        provider: 'anthropic',
        inputPrice: '3.000000',
        outputPrice: '15.000000',
        userInputPrice: '3.600000',
        userOutputPrice: '18.000000',
        perRequestPrice: '0.000000',
        subProvider: null,
      };
      const spy = vi.spyOn(serverDB.query.modelPricings, 'findFirst').mockResolvedValue(mockPricing as any);

      const cost = await creditService.calculateCost(
        'claude-3-sonnet',
        'anthropic',
        1_000_000,
        1_000_000,
        false,
      );

      // Expected: (1_000_000 / 1_000_000) * 3.6 + (1_000_000 / 1_000_000) * 18 = 3.6 + 18 = 21.6
      expect(cost).toBe(21.6);
      spy.mockRestore();
    });

    it('should handle very small token counts', async () => {
      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        inputPrice: '30.000000',
        outputPrice: '60.000000',
        userInputPrice: '36.000000',
        userOutputPrice: '72.000000',
        perRequestPrice: '0.000000',
        subProvider: null,
      };
      const spy = vi.spyOn(serverDB.query.modelPricings, 'findFirst').mockResolvedValue(mockPricing as any);

      // Just 10 input tokens and 5 output tokens
      const cost = await creditService.calculateCost('gpt-4', 'openai', 10, 5, false);

      // Expected: (10 / 1_000_000) * 36 + (5 / 1_000_000) * 72 = 0.00036 + 0.00036 = 0.00072
      expect(cost).toBe(0.00072);
      spy.mockRestore();
    });

    it('should handle pricing with null perRequestPrice', async () => {
      const mockPricing = {
        model: 'test-model',
        provider: 'test-provider',
        inputPrice: '10.000000',
        outputPrice: '20.000000',
        userInputPrice: '12.000000',
        userOutputPrice: '24.000000',
        perRequestPrice: null,
        subProvider: null,
      };
      const spy = vi.spyOn(serverDB.query.modelPricings, 'findFirst').mockResolvedValue(mockPricing as any);

      const cost = await creditService.calculateCost('test-model', 'test-provider', 1_000_000, 1_000_000, false);

      // Should treat null as 0
      expect(cost).toBe(36); // 12 + 24
      spy.mockRestore();
    });
  });

  describe('deductCredits', () => {
    it('should deduct credits from user balance successfully', async () => {
      const result = await creditService.deductCredits(10.5, 'Test deduction', 'test-ref-123');

      expect(result).toBe(89.5); // 100 - 10.5

      // Verify balance was updated
      const balance = await serverDB.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId),
      });
      expect(balance?.balance).toBe('89.5000');

      // Verify transaction was recorded
      const transactions = await serverDB.query.userTransactions.findMany({
        where: eq(userTransactions.userId, userId),
      });
      expect(transactions).toHaveLength(1);
      expect(transactions[0].amount).toBe('-10.5000');
      expect(transactions[0].balanceAfter).toBe('89.5000');
      expect(transactions[0].type).toBe('CONSUMPTION');
      expect(transactions[0].category).toBe('CONSUMPTION');
      expect(transactions[0].description).toBe('Test deduction');
      expect(transactions[0].refId).toBe('test-ref-123');
    });

    it('should not deduct when amount is 0', async () => {
      await creditService.deductCredits(0, 'Zero deduction');

      // Balance should remain unchanged
      const balance = await serverDB.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId),
      });
      expect(balance?.balance).toBe('100.0000');

      // No transaction should be created
      const transactions = await serverDB.query.userTransactions.findMany({
        where: eq(userTransactions.userId, userId),
      });
      expect(transactions).toHaveLength(0);
    });

    it('should not deduct when amount is negative', async () => {
      await creditService.deductCredits(-5, 'Negative deduction');

      // Balance should remain unchanged
      const balance = await serverDB.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId),
      });
      expect(balance?.balance).toBe('100.0000');

      // No transaction should be created
      const transactions = await serverDB.query.userTransactions.findMany({
        where: eq(userTransactions.userId, userId),
      });
      expect(transactions).toHaveLength(0);
    });

    it('should throw error when user balance not found', async () => {
      const nonExistentService = new CreditService(serverDB, 'non-existent-user');

      await expect(
        nonExistentService.deductCredits(10, 'Test deduction'),
      ).rejects.toThrow('User balance not found');
    });

    it('should throw error when insufficient credits', async () => {
      await expect(
        creditService.deductCredits(150, 'Excessive deduction'),
      ).rejects.toThrow('Insufficient credits');

      // Balance should remain unchanged
      const balance = await serverDB.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId),
      });
      expect(balance?.balance).toBe('100.0000');

      // No transaction should be created
      const transactions = await serverDB.query.userTransactions.findMany({
        where: eq(userTransactions.userId, userId),
      });
      expect(transactions).toHaveLength(0);
    });

    it('should allow deduction for unlimited balance users', async () => {
      // Update user to have unlimited balance
      await serverDB
        .update(userBalances)
        .set({ isUnlimited: true })
        .where(eq(userBalances.userId, userId));

      const result = await creditService.deductCredits(1000, 'Large deduction for unlimited user');

      expect(result).toBe(-900); // 100 - 1000

      // Verify balance was updated (can go negative for unlimited users)
      const balance = await serverDB.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId),
      });
      expect(balance?.balance).toBe('-900.0000');
    });

    it('should record transaction with metadata', async () => {
      const metadata = {
        model: 'gpt-4',
        provider: 'openai',
        inputTokens: 1000,
        outputTokens: 500,
      };

      await creditService.deductCredits(5.5, 'Model usage', 'msg-123', metadata);

      const transactions = await serverDB.query.userTransactions.findMany({
        where: eq(userTransactions.userId, userId),
      });
      expect(transactions).toHaveLength(1);
      expect(transactions[0].metadata).toEqual(metadata);
    });

    it('should handle multiple consecutive deductions', async () => {
      await creditService.deductCredits(10, 'First deduction');
      await creditService.deductCredits(20, 'Second deduction');
      await creditService.deductCredits(30, 'Third deduction');

      const balance = await serverDB.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId),
      });
      expect(balance?.balance).toBe('40.0000'); // 100 - 10 - 20 - 30

      const transactions = await serverDB.query.userTransactions.findMany({
        where: eq(userTransactions.userId, userId),
      });
      expect(transactions).toHaveLength(3);
    });

    it('should handle very precise decimal amounts', async () => {
      const result = await creditService.deductCredits(0.0123, 'Tiny deduction');

      expect(result).toBeCloseTo(99.9877, 4);

      const balance = await serverDB.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId),
      });
      expect(balance?.balance).toBe('99.9877');
    });
  });

  describe('hasEnoughCredits', () => {
    it('should return true when user has sufficient credits', async () => {
      const result = await creditService.hasEnoughCredits(50);

      expect(result).toBe(true);
    });

    it('should return false when user has insufficient credits', async () => {
      const result = await creditService.hasEnoughCredits(150);

      expect(result).toBe(false);
    });

    it('should return true when estimatedAmount is 0 and balance is positive', async () => {
      const result = await creditService.hasEnoughCredits(0);

      expect(result).toBe(true);
    });

    it('should return true when estimatedAmount equals balance exactly', async () => {
      const result = await creditService.hasEnoughCredits(100);

      expect(result).toBe(true);
    });

    it('should return false when balance is 0', async () => {
      await serverDB
        .update(userBalances)
        .set({ balance: '0.0000' })
        .where(eq(userBalances.userId, userId));

      const result = await creditService.hasEnoughCredits(0);

      expect(result).toBe(false);
    });

    it('should return true for unlimited balance users regardless of amount', async () => {
      await serverDB
        .update(userBalances)
        .set({ isUnlimited: true })
        .where(eq(userBalances.userId, userId));

      const result = await creditService.hasEnoughCredits(999999);

      expect(result).toBe(true);
    });

    it('should return false when user balance not found', async () => {
      const nonExistentService = new CreditService(serverDB, 'non-existent-user');

      const result = await nonExistentService.hasEnoughCredits(10);

      expect(result).toBe(false);
    });

    it('should handle very small amounts', async () => {
      const result = await creditService.hasEnoughCredits(0.0001);

      expect(result).toBe(true);
    });

    it('should return false when balance is negative', async () => {
      await serverDB
        .update(userBalances)
        .set({ balance: '-10.0000' })
        .where(eq(userBalances.userId, userId));

      const result = await creditService.hasEnoughCredits(0);

      expect(result).toBe(false);
    });

    it('should handle default parameter (estimatedAmount = 0)', async () => {
      const result = await creditService.hasEnoughCredits();

      expect(result).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete usage flow: check credits, calculate cost, and deduct', async () => {
      // Mock pricing
      const mockPricing = {
        model: 'gpt-4',
        provider: 'openai',
        inputPrice: '30.000000',
        outputPrice: '60.000000',
        userInputPrice: '36.000000',
        userOutputPrice: '72.000000',
        perRequestPrice: '0.000000',
        subProvider: null,
      };
      const spy = vi.spyOn(serverDB.query.modelPricings, 'findFirst').mockResolvedValue(mockPricing as any);

      // Step 1: Calculate cost
      const cost = await creditService.calculateCost('gpt-4', 'openai', 100_000, 50_000, false);
      expect(cost).toBe(7.2); // (100K/1M)*36 + (50K/1M)*72 = 3.6 + 3.6 = 7.2

      // Step 2: Check if user has enough credits
      const hasEnough = await creditService.hasEnoughCredits(cost);
      expect(hasEnough).toBe(true);

      // Step 3: Deduct credits
      const newBalance = await creditService.deductCredits(cost, 'GPT-4 usage', 'msg-456');
      expect(newBalance).toBeCloseTo(92.8, 4); // 100 - 7.2

      spy.mockRestore();
    });

    it('should prevent deduction when pre-check shows insufficient credits', async () => {
      // Set low balance
      await serverDB
        .update(userBalances)
        .set({ balance: '5.0000' })
        .where(eq(userBalances.userId, userId));

      const hasEnough = await creditService.hasEnoughCredits(10);
      expect(hasEnough).toBe(false);

      // Should not attempt deduction
      await expect(creditService.deductCredits(10, 'Should fail')).rejects.toThrow(
        'Insufficient credits',
      );
    });

    it('should handle transaction rollback on error', async () => {
      // Create a scenario where transaction should rollback
      // by trying to deduct more than available
      const initialBalance = '100.0000';

      await expect(creditService.deductCredits(200, 'Too much')).rejects.toThrow(
        'Insufficient credits',
      );

      // Balance should remain unchanged
      const balance = await serverDB.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId),
      });
      expect(balance?.balance).toBe(initialBalance);

      // No transaction should be recorded
      const transactions = await serverDB.query.userTransactions.findMany({
        where: eq(userTransactions.userId, userId),
      });
      expect(transactions).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle floating point precision correctly', async () => {
      await serverDB
        .update(userBalances)
        .set({ balance: '10.0000' })
        .where(eq(userBalances.userId, userId));

      // Deduct amounts that might cause floating point errors
      await creditService.deductCredits(3.33, 'First');
      await creditService.deductCredits(3.33, 'Second');
      await creditService.deductCredits(3.34, 'Third');

      const balance = await serverDB.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId),
      });
      expect(balance?.balance).toBe('0.0000'); // Should be exactly 0
    });

    it('should handle concurrent deductions correctly', async () => {
      // Note: This test verifies that database transactions prevent race conditions
      // Both deductions should succeed if total <= balance
      const promises = [
        creditService.deductCredits(40, 'Concurrent 1'),
        creditService.deductCredits(40, 'Concurrent 2'),
      ];

      await Promise.all(promises);

      const balance = await serverDB.query.userBalances.findFirst({
        where: eq(userBalances.userId, userId),
      });
      expect(balance?.balance).toBe('20.0000');

      const transactions = await serverDB.query.userTransactions.findMany({
        where: eq(userTransactions.userId, userId),
      });
      expect(transactions).toHaveLength(2);
    });
  });
});
