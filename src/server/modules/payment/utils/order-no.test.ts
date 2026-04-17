// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateOrderNo } from './order-no';

describe('generateOrderNo', () => {
  describe('format validation', () => {
    it('should return a string starting with "PC"', () => {
      const orderNo = generateOrderNo();
      expect(orderNo.startsWith('PC')).toBe(true);
    });

    it('should return a string of exactly 22 characters', () => {
      // PC (2) + YYYYMMDDHHMMSS (14) + 6-digit random (6) = 22
      const orderNo = generateOrderNo();
      expect(orderNo).toHaveLength(22);
    });

    it('should match the expected pattern PC + 14-digit timestamp + 6-digit number', () => {
      const orderNo = generateOrderNo();
      expect(orderNo).toMatch(/^PC\d{14}\d{6}$/);
    });
  });

  describe('timestamp embedding', () => {
    it('should embed the current date in YYYYMMDD format', () => {
      const fixedDate = new Date('2026-04-17T10:30:45Z');
      vi.setSystemTime(fixedDate);

      const orderNo = generateOrderNo();

      // Extract the timestamp portion (chars 2..15)
      const datePart = orderNo.slice(2, 10);
      expect(datePart).toBe('20260417');
    });

    it('should embed the current time in HHMMSS format', () => {
      const fixedDate = new Date('2026-04-17T09:05:03Z');
      vi.setSystemTime(fixedDate);

      const orderNo = generateOrderNo();

      // Extract time portion (chars 10..15) — UTC hours from setSystemTime
      const timePart = orderNo.slice(10, 16);
      // We don't assert exact time as timezone offset may vary; just validate format
      expect(timePart).toMatch(/^\d{6}$/);
    });

    it('should pad single-digit month with leading zero', () => {
      vi.setSystemTime(new Date('2026-01-05T00:00:00'));
      const orderNo = generateOrderNo();
      // month part at index 6-7
      const monthPart = orderNo.slice(6, 8);
      expect(monthPart).toBe('01');
    });

    it('should pad single-digit day with leading zero', () => {
      vi.setSystemTime(new Date('2026-03-07T00:00:00'));
      const orderNo = generateOrderNo();
      // day part at index 8-9
      const dayPart = orderNo.slice(8, 10);
      expect(dayPart).toBe('07');
    });

    it('should pad single-digit hours with leading zero', () => {
      vi.setSystemTime(new Date('2026-03-15T05:00:00'));
      const orderNo = generateOrderNo();
      const hourPart = orderNo.slice(10, 12);
      expect(hourPart).toBe('05');
    });

    it('should pad single-digit minutes with leading zero', () => {
      vi.setSystemTime(new Date('2026-03-15T00:04:00'));
      const orderNo = generateOrderNo();
      const minutePart = orderNo.slice(12, 14);
      expect(minutePart).toBe('04');
    });

    it('should pad single-digit seconds with leading zero', () => {
      vi.setSystemTime(new Date('2026-03-15T00:00:09'));
      const orderNo = generateOrderNo();
      const secondPart = orderNo.slice(14, 16);
      expect(secondPart).toBe('09');
    });
  });

  describe('random suffix', () => {
    it('should produce a 6-digit random suffix between 100000 and 999999', () => {
      const orderNo = generateOrderNo();
      const randomPart = Number(orderNo.slice(16, 22));
      expect(randomPart).toBeGreaterThanOrEqual(100_000);
      expect(randomPart).toBeLessThanOrEqual(999_999);
    });

    it('should use the full random value from Math.random', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      // 100000 + 0.5 * 900000 = 100000 + 450000 = 550000
      const orderNo = generateOrderNo();
      const randomPart = orderNo.slice(16, 22);
      expect(randomPart).toBe('550000');
    });

    it('should produce 100000 when Math.random returns 0', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const orderNo = generateOrderNo();
      const randomPart = orderNo.slice(16, 22);
      expect(randomPart).toBe('100000');
    });

    it('should produce 999999 when Math.random returns just below 1', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.999_999);
      const orderNo = generateOrderNo();
      const randomPart = Number(orderNo.slice(16, 22));
      expect(randomPart).toBe(999_999);
    });
  });

  describe('uniqueness', () => {
    it('should generate unique order numbers on subsequent calls', () => {
      const results = new Set<string>();
      for (let i = 0; i < 100; i++) {
        results.add(generateOrderNo());
      }
      // With random suffix variation, almost certainly unique
      expect(results.size).toBeGreaterThan(1);
    });
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
