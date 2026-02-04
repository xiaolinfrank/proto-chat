// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateOrderNo } from './order-no';

describe('generateOrderNo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('format validation', () => {
    it('should generate order number with correct format PC + timestamp + random', () => {
      const orderNo = generateOrderNo();

      // Format: PC + YYYYMMDDHHMMSS + 6-digit random
      expect(orderNo).toMatch(/^PC\d{14}\d{6}$/);
      expect(orderNo.length).toBe(22); // PC(2) + timestamp(14) + random(6)
      expect(orderNo.startsWith('PC')).toBe(true);
    });

    it('should generate order number with valid timestamp format', () => {
      const now = new Date();
      const orderNo = generateOrderNo();

      // Extract timestamp portion (positions 2-15)
      const timestamp = orderNo.slice(2, 16);

      // Validate year
      const year = parseInt(timestamp.slice(0, 4));
      expect(year).toBe(now.getFullYear());

      // Validate month (01-12)
      const month = parseInt(timestamp.slice(4, 6));
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);

      // Validate day (01-31)
      const day = parseInt(timestamp.slice(6, 8));
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(31);

      // Validate hour (00-23)
      const hour = parseInt(timestamp.slice(8, 10));
      expect(hour).toBeGreaterThanOrEqual(0);
      expect(hour).toBeLessThanOrEqual(23);

      // Validate minute (00-59)
      const minute = parseInt(timestamp.slice(10, 12));
      expect(minute).toBeGreaterThanOrEqual(0);
      expect(minute).toBeLessThanOrEqual(59);

      // Validate second (00-59)
      const second = parseInt(timestamp.slice(12, 14));
      expect(second).toBeGreaterThanOrEqual(0);
      expect(second).toBeLessThanOrEqual(59);
    });

    it('should generate 6-digit random number', () => {
      const orderNo = generateOrderNo();

      // Extract random portion (last 6 digits)
      const randomPart = orderNo.slice(-6);
      const randomNumber = parseInt(randomPart);

      // Verify it's a 6-digit number (100000-999999)
      expect(randomNumber).toBeGreaterThanOrEqual(100_000);
      expect(randomNumber).toBeLessThanOrEqual(999_999);
      expect(randomPart.length).toBe(6);
    });
  });

  describe('uniqueness', () => {
    it('should generate different order numbers on consecutive calls', () => {
      const orderNo1 = generateOrderNo();
      const orderNo2 = generateOrderNo();

      expect(orderNo1).not.toBe(orderNo2);
    });

    it('should generate unique order numbers in batch', () => {
      const batchSize = 100;
      const orderNumbers = new Set<string>();

      for (let i = 0; i < batchSize; i++) {
        orderNumbers.add(generateOrderNo());
      }

      // All should be unique due to random component
      expect(orderNumbers.size).toBe(batchSize);
    });
  });

  describe('timestamp accuracy', () => {
    it('should use current date and time for timestamp', () => {
      const before = new Date();
      const orderNo = generateOrderNo();
      const after = new Date();

      // Extract and parse timestamp
      const timestamp = orderNo.slice(2, 16);
      const year = timestamp.slice(0, 4);
      const month = timestamp.slice(4, 6);
      const day = timestamp.slice(6, 8);

      expect(year).toBe(String(before.getFullYear()));
      expect(month).toBe(String(before.getMonth() + 1).padStart(2, '0'));
      expect(day).toBe(String(before.getDate()).padStart(2, '0'));
    });

    it('should pad single digit month and day with zero', () => {
      // Mock a date with single digit month and day
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-05T03:04:05'));

      const orderNo = generateOrderNo();

      expect(orderNo).toMatch(/^PC20240105030405\d{6}$/);

      vi.useRealTimers();
    });

    it('should format hours, minutes, seconds with leading zeros', () => {
      // Mock early morning time
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15T01:02:03'));

      const orderNo = generateOrderNo();

      expect(orderNo).toMatch(/^PC20240615010203\d{6}$/);

      vi.useRealTimers();
    });
  });

  describe('edge cases', () => {
    it('should handle year boundary correctly', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-12-31T23:59:59'));

      const orderNo = generateOrderNo();

      expect(orderNo.startsWith('PC20241231235959')).toBe(true);

      vi.useRealTimers();
    });

    it('should handle leap year date correctly', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-02-29T12:30:45'));

      const orderNo = generateOrderNo();

      expect(orderNo.startsWith('PC20240229123045')).toBe(true);

      vi.useRealTimers();
    });

    it('should handle midnight correctly', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-06-15T00:00:00'));

      const orderNo = generateOrderNo();

      expect(orderNo.startsWith('PC20240615000000')).toBe(true);

      vi.useRealTimers();
    });
  });
});
