// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateOrderNo } from './order-no';

describe('generateOrderNo', () => {
  it('should start with "PC" prefix', () => {
    const orderNo = generateOrderNo();
    expect(orderNo.startsWith('PC')).toBe(true);
  });

  it('should have the correct length (PC + 14 timestamp + 6 random = 22 chars)', () => {
    const orderNo = generateOrderNo();
    // PC = 2, YYYYMMDDHHMMSS = 14, random 6 digits = 6 → total 22
    expect(orderNo).toHaveLength(22);
  });

  it('should match the expected format: PC + 14-digit timestamp + 6-digit random', () => {
    const orderNo = generateOrderNo();
    // Format: PC + YYYYMMDDHHMMSS + 6-digit number
    expect(orderNo).toMatch(/^PC\d{14}\d{6}$/);
  });

  it('should embed a valid timestamp in the order number', () => {
    const before = new Date();
    const orderNo = generateOrderNo();
    const after = new Date();

    // Extract timestamp portion: characters 2–15 (YYYYMMDDHHMMSS)
    const tsPart = orderNo.slice(2, 16);
    const year = Number(tsPart.slice(0, 4));
    const month = Number(tsPart.slice(4, 6)) - 1; // zero-based
    const day = Number(tsPart.slice(6, 8));
    const hours = Number(tsPart.slice(8, 10));
    const minutes = Number(tsPart.slice(10, 12));
    const seconds = Number(tsPart.slice(12, 14));

    const ts = new Date(year, month, day, hours, minutes, seconds);

    // Timestamp should be within the range when the order was generated
    // Compare only to the second level (strip ms from before/after)
    const beforeSec = new Date(Math.floor(before.getTime() / 1000) * 1000);
    const afterSec = new Date(Math.ceil(after.getTime() / 1000) * 1000);

    expect(ts.getTime()).toBeGreaterThanOrEqual(beforeSec.getTime());
    expect(ts.getTime()).toBeLessThanOrEqual(afterSec.getTime());
  });

  it('should include a 6-digit random number (100000–999999)', () => {
    const orderNo = generateOrderNo();
    // Last 6 characters are the random part
    const randomPart = Number(orderNo.slice(-6));

    expect(randomPart).toBeGreaterThanOrEqual(100_000);
    expect(randomPart).toBeLessThanOrEqual(999_999);
  });

  it('should generate unique order numbers across multiple calls', () => {
    const count = 100;
    const orderNos = new Set(Array.from({ length: count }, () => generateOrderNo()));
    // With a 6-digit random component (900,000 possibilities) there should be no collisions
    expect(orderNos.size).toBe(count);
  });

  it('should zero-pad single-digit months and days', () => {
    // Pin the clock to January 5th so month = '01' and day = '05'
    const fixedDate = new Date(2025, 0, 5, 9, 3, 7); // 2025-01-05 09:03:07
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);

    const orderNo = generateOrderNo();

    vi.useRealTimers();

    // Expected: PC 2025 01 05 09 03 07 XXXXXX
    expect(orderNo.slice(2, 16)).toBe('20250105090307');
  });

  describe('timestamp padding', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should pad month with leading zero when month < 10', () => {
      vi.setSystemTime(new Date(2025, 2, 15, 0, 0, 0)); // March = month index 2 → '03'
      const orderNo = generateOrderNo();
      expect(orderNo.slice(6, 8)).toBe('03');
    });

    it('should pad day with leading zero when day < 10', () => {
      vi.setSystemTime(new Date(2025, 5, 7, 0, 0, 0)); // Day 7 → '07'
      const orderNo = generateOrderNo();
      expect(orderNo.slice(8, 10)).toBe('07');
    });

    it('should pad hours, minutes, and seconds with leading zeros', () => {
      vi.setSystemTime(new Date(2025, 0, 1, 3, 5, 9)); // 03:05:09
      const orderNo = generateOrderNo();
      const tsPart = orderNo.slice(2, 16);
      expect(tsPart.slice(8, 10)).toBe('03'); // hours
      expect(tsPart.slice(10, 12)).toBe('05'); // minutes
      expect(tsPart.slice(12, 14)).toBe('09'); // seconds
    });
  });
});
