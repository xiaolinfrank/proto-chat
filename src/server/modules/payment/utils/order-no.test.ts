// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateOrderNo } from './order-no';

describe('generateOrderNo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic format validation', () => {
    it('should generate order number with correct prefix', () => {
      const orderNo = generateOrderNo();

      expect(orderNo).toMatch(/^PC/);
    });

    it('should generate order number with correct total length', () => {
      const orderNo = generateOrderNo();

      // PC (2) + YYYYMMDDHHMMSS (14) + random (6) = 22 characters
      expect(orderNo).toHaveLength(22);
    });

    it('should generate order number matching full pattern', () => {
      const orderNo = generateOrderNo();

      // Pattern: PC + 14 digits (timestamp) + 6 digits (random)
      expect(orderNo).toMatch(/^PC\d{14}\d{6}$/);
    });
  });

  describe('timestamp component', () => {
    it('should include current year in timestamp', () => {
      const orderNo = generateOrderNo();
      const year = new Date().getFullYear();
      const timestampPart = orderNo.slice(2, 6); // Extract YYYY part

      expect(timestampPart).toBe(String(year));
    });

    it('should format month with leading zero', () => {
      // Mock date with single-digit month (January = 0)
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 15, 10, 30, 45)); // January 15, 2024

      const orderNo = generateOrderNo();
      const monthPart = orderNo.slice(6, 8); // Extract MM part

      expect(monthPart).toBe('01');

      vi.useRealTimers();
    });

    it('should format day with leading zero', () => {
      // Mock date with single-digit day
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 5, 10, 30, 45)); // June 5, 2024

      const orderNo = generateOrderNo();
      const dayPart = orderNo.slice(8, 10); // Extract DD part

      expect(dayPart).toBe('05');

      vi.useRealTimers();
    });

    it('should format hours with leading zero', () => {
      // Mock date with single-digit hour
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 15, 5, 30, 45)); // 5 AM

      const orderNo = generateOrderNo();
      const hourPart = orderNo.slice(10, 12); // Extract HH part

      expect(hourPart).toBe('05');

      vi.useRealTimers();
    });

    it('should format minutes with leading zero', () => {
      // Mock date with single-digit minutes
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 15, 10, 5, 45)); // 10:05

      const orderNo = generateOrderNo();
      const minutePart = orderNo.slice(12, 14); // Extract MM part

      expect(minutePart).toBe('05');

      vi.useRealTimers();
    });

    it('should format seconds with leading zero', () => {
      // Mock date with single-digit seconds
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 15, 10, 30, 5)); // 10:30:05

      const orderNo = generateOrderNo();
      const secondPart = orderNo.slice(14, 16); // Extract SS part

      expect(secondPart).toBe('05');

      vi.useRealTimers();
    });

    it('should generate correct timestamp for known date', () => {
      // Mock specific date and time
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 27, 9, 30, 45)); // Jan 27, 2024 09:30:45

      const orderNo = generateOrderNo();
      const timestampPart = orderNo.slice(2, 16); // Extract YYYYMMDDHHMMSS

      expect(timestampPart).toBe('20240127093045');

      vi.useRealTimers();
    });
  });

  describe('random number component', () => {
    it('should include 6-digit random number', () => {
      const orderNo = generateOrderNo();
      const randomPart = orderNo.slice(16); // Last 6 characters

      expect(randomPart).toHaveLength(6);
      expect(randomPart).toMatch(/^\d{6}$/);
    });

    it('should generate random number in range 100000-999999', () => {
      // Run multiple times to test randomness
      for (let i = 0; i < 100; i++) {
        const orderNo = generateOrderNo();
        const randomPart = Number.parseInt(orderNo.slice(16), 10);

        expect(randomPart).toBeGreaterThanOrEqual(100_000);
        expect(randomPart).toBeLessThanOrEqual(999_999);
      }
    });

    it('should generate minimum random number (100000)', () => {
      // Mock Math.random to return 0
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const orderNo = generateOrderNo();
      const randomPart = orderNo.slice(16);

      expect(randomPart).toBe('100000');
    });

    it('should generate maximum random number (999999)', () => {
      // Mock Math.random to return value close to 1 (0.999999)
      vi.spyOn(Math, 'random').mockReturnValue(0.999_999);

      const orderNo = generateOrderNo();
      const randomPart = orderNo.slice(16);

      expect(randomPart).toBe('999999');
    });
  });

  describe('uniqueness', () => {
    it('should generate different order numbers on successive calls', () => {
      // Use real timers and restore all mocks
      vi.useRealTimers();
      vi.restoreAllMocks();

      const orderNo1 = generateOrderNo();
      const orderNo2 = generateOrderNo();
      const orderNo3 = generateOrderNo();

      // Collect all order numbers
      const orderNumbers = [orderNo1, orderNo2, orderNo3];

      // At least one should be different due to random component
      // (might have same timestamp but different random)
      const uniqueCount = new Set(orderNumbers).size;
      expect(uniqueCount).toBeGreaterThan(1);
    });

    it('should generate unique order numbers in batch', () => {
      vi.useRealTimers();
      vi.restoreAllMocks();

      const orderNumbers = new Set<string>();
      const count = 1000;

      for (let i = 0; i < count; i++) {
        orderNumbers.add(generateOrderNo());
      }

      // Due to randomness and time progression, most should be unique
      // Allow for some collisions due to same timestamp + random collision
      expect(orderNumbers.size).toBeGreaterThan(count * 0.95); // 95% uniqueness
    });
  });

  describe('edge cases', () => {
    it('should handle year boundary (New Year)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 1, 0, 0, 0)); // Jan 1, 2024 00:00:00

      const orderNo = generateOrderNo();

      expect(orderNo).toMatch(/^PC20240101000000\d{6}$/);

      vi.useRealTimers();
    });

    it('should handle month boundary (end of month)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 31, 23, 59, 59)); // Jan 31, 2024 23:59:59

      const orderNo = generateOrderNo();

      expect(orderNo).toMatch(/^PC20240131235959\d{6}$/);

      vi.useRealTimers();
    });

    it('should handle leap year date', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 1, 29, 12, 0, 0)); // Feb 29, 2024 (leap year)

      const orderNo = generateOrderNo();

      expect(orderNo).toMatch(/^PC20240229120000\d{6}$/);

      vi.useRealTimers();
    });

    it('should handle midnight time', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 15, 0, 0, 0));

      const orderNo = generateOrderNo();

      expect(orderNo).toMatch(/^PC20240615000000\d{6}$/);

      vi.useRealTimers();
    });

    it('should handle end of day time', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 15, 23, 59, 59));

      const orderNo = generateOrderNo();

      expect(orderNo).toMatch(/^PC20240615235959\d{6}$/);

      vi.useRealTimers();
    });
  });

  describe('consistency and determinism', () => {
    it('should produce consistent format across multiple calls', () => {
      vi.useRealTimers();

      const orderNumbers = Array.from({ length: 100 }, () => generateOrderNo());

      orderNumbers.forEach((orderNo) => {
        expect(orderNo).toMatch(/^PC\d{14}\d{6}$/);
        expect(orderNo).toHaveLength(22);
      });
    });

    it('should be deterministic when Date and Math.random are mocked', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 15, 10, 30, 45));
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const orderNo1 = generateOrderNo();
      const orderNo2 = generateOrderNo();

      expect(orderNo1).toBe(orderNo2);
      expect(orderNo1).toBe('PC20240115103045550000');

      vi.useRealTimers();
    });
  });

  describe('integration scenarios', () => {
    it('should generate valid order numbers for payment processing', () => {
      vi.useRealTimers();

      // Simulate real-world payment scenario
      const orderNo = generateOrderNo();

      // Verify it would work in a payment system
      expect(orderNo).toBeTruthy();
      expect(typeof orderNo).toBe('string');
      expect(orderNo.startsWith('PC')).toBe(true);

      // Can be stored in database (reasonable length)
      expect(orderNo.length).toBeLessThan(50);

      // Contains only alphanumeric characters
      expect(orderNo).toMatch(/^[A-Z0-9]+$/);
    });

    it('should generate order numbers that can be sorted chronologically', () => {
      vi.useFakeTimers();
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // Same random for comparison

      vi.setSystemTime(new Date(2024, 0, 15, 10, 0, 0));
      const orderNo1 = generateOrderNo();

      vi.setSystemTime(new Date(2024, 0, 15, 11, 0, 0));
      const orderNo2 = generateOrderNo();

      vi.setSystemTime(new Date(2024, 0, 16, 10, 0, 0));
      const orderNo3 = generateOrderNo();

      // Lexicographic sorting should match chronological order
      const sorted = [orderNo1, orderNo2, orderNo3].sort();
      expect(sorted).toEqual([orderNo1, orderNo2, orderNo3]);

      vi.useRealTimers();
    });
  });
});
