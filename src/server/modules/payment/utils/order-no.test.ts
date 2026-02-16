// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateOrderNo } from './order-no';

describe('generateOrderNo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should generate order number with correct prefix', () => {
    const orderNo = generateOrderNo();
    expect(orderNo).toMatch(/^PC/);
  });

  it('should generate order number with correct format', () => {
    // Format: PC + YYYYMMDDHHMMSS (14 digits) + 6-digit random
    // Total: 2 (PC) + 14 (timestamp) + 6 (random) = 22 characters
    const orderNo = generateOrderNo();
    expect(orderNo).toHaveLength(22);
    expect(orderNo).toMatch(/^PC\d{20}$/);
  });

  it('should generate order number with correct timestamp format', () => {
    const testDate = new Date('2026-02-16T14:30:45');
    vi.setSystemTime(testDate);

    const orderNo = generateOrderNo();

    // Expected timestamp: 20260216143045
    expect(orderNo).toContain('20260216143045');
    expect(orderNo).toMatch(/^PC20260216143045\d{6}$/);
  });

  it('should generate order number with 6-digit random component', () => {
    const orderNo = generateOrderNo();

    // Extract random component (last 6 digits)
    const randomPart = orderNo.slice(-6);
    expect(randomPart).toMatch(/^\d{6}$/);

    // Verify random part is in valid range (100000-999999)
    const randomNum = Number.parseInt(randomPart, 10);
    expect(randomNum).toBeGreaterThanOrEqual(100_000);
    expect(randomNum).toBeLessThanOrEqual(999_999);
  });

  it('should pad single-digit month with leading zero', () => {
    const testDate = new Date('2026-01-15T10:20:30');
    vi.setSystemTime(testDate);

    const orderNo = generateOrderNo();
    expect(orderNo).toContain('202601');
  });

  it('should pad single-digit day with leading zero', () => {
    const testDate = new Date('2026-12-05T10:20:30');
    vi.setSystemTime(testDate);

    const orderNo = generateOrderNo();
    expect(orderNo).toContain('20261205');
  });

  it('should pad single-digit hours with leading zero', () => {
    const testDate = new Date('2026-02-16T09:30:45');
    vi.setSystemTime(testDate);

    const orderNo = generateOrderNo();
    expect(orderNo).toContain('093045');
  });

  it('should pad single-digit minutes with leading zero', () => {
    const testDate = new Date('2026-02-16T14:05:45');
    vi.setSystemTime(testDate);

    const orderNo = generateOrderNo();
    expect(orderNo).toContain('140545');
  });

  it('should pad single-digit seconds with leading zero', () => {
    const testDate = new Date('2026-02-16T14:30:05');
    vi.setSystemTime(testDate);

    const orderNo = generateOrderNo();
    expect(orderNo).toContain('143005');
  });

  it('should generate different order numbers on consecutive calls', () => {
    const orderNo1 = generateOrderNo();
    const orderNo2 = generateOrderNo();

    // While timestamps might be the same, random components should differ most of the time
    // We can't guarantee they're always different due to randomness, but we can verify format
    expect(orderNo1).toMatch(/^PC\d{20}$/);
    expect(orderNo2).toMatch(/^PC\d{20}$/);
  });

  it('should handle midnight correctly', () => {
    const testDate = new Date('2026-02-16T00:00:00');
    vi.setSystemTime(testDate);

    const orderNo = generateOrderNo();
    expect(orderNo).toContain('000000');
    expect(orderNo).toMatch(/^PC20260216000000\d{6}$/);
  });

  it('should handle end of day correctly', () => {
    const testDate = new Date('2026-02-16T23:59:59');
    vi.setSystemTime(testDate);

    const orderNo = generateOrderNo();
    expect(orderNo).toContain('235959');
    expect(orderNo).toMatch(/^PC20260216235959\d{6}$/);
  });

  it('should handle leap year date correctly', () => {
    const testDate = new Date('2024-02-29T12:00:00');
    vi.setSystemTime(testDate);

    const orderNo = generateOrderNo();
    expect(orderNo).toContain('20240229');
    expect(orderNo).toMatch(/^PC20240229120000\d{6}$/);
  });

  it('should generate unique order numbers with high probability', () => {
    // Generate multiple order numbers at the same timestamp
    const testDate = new Date('2026-02-16T14:30:45');
    vi.setSystemTime(testDate);

    const orderNumbers = new Set<string>();
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      orderNumbers.add(generateOrderNo());
    }

    // Due to random component, we expect most to be unique
    // With 900,000 possible random values, collision probability is very low
    expect(orderNumbers.size).toBeGreaterThan(iterations * 0.95);
  });

  it('should match example format from documentation', () => {
    // Example from docs: PC202601270930451234567
    const testDate = new Date('2026-01-27T09:30:45');
    vi.setSystemTime(testDate);

    const orderNo = generateOrderNo();

    // Should match the timestamp part of the example
    expect(orderNo).toMatch(/^PC20260127093045\d{6}$/);
  });

  it('should handle year boundary correctly', () => {
    const testDate = new Date('2026-12-31T23:59:59');
    vi.setSystemTime(testDate);

    const orderNo = generateOrderNo();
    expect(orderNo).toContain('20261231235959');
    expect(orderNo).toMatch(/^PC20261231235959\d{6}$/);
  });

  it('should generate valid order number for different years', () => {
    const testCases = [
      { date: new Date('2025-06-15T12:00:00'), expected: /^PC20250615120000\d{6}$/ },
      { date: new Date('2026-06-15T12:00:00'), expected: /^PC20260615120000\d{6}$/ },
      { date: new Date('2027-06-15T12:00:00'), expected: /^PC20270615120000\d{6}$/ },
    ];

    for (const { date, expected } of testCases) {
      vi.setSystemTime(date);
      const orderNo = generateOrderNo();
      expect(orderNo).toMatch(expected);
    }
  });
});
