// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateOrderNo } from './order-no';

describe('generateOrderNo', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.restoreAllMocks();
  });

  it('should generate order number with correct format', () => {
    const orderNo = generateOrderNo();

    // Should start with "PC"
    expect(orderNo).toMatch(/^PC/);

    // Total length should be 22 characters: PC(2) + timestamp(14) + random(6) = 22
    expect(orderNo).toHaveLength(22);

    // Should match the full pattern: PC + 14 digits + 6 digits
    expect(orderNo).toMatch(/^PC\d{14}\d{6}$/);
  });

  it('should generate order number with current timestamp', () => {
    const mockDate = new Date('2026-02-17T09:30:45.123Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();

    // Extract timestamp portion (after "PC", 14 digits)
    const timestamp = orderNo.slice(2, 16);

    // Should be: 20260217093045 (YYYYMMDDHHMMSS in UTC)
    expect(timestamp).toBe('20260217093045');
  });

  it('should generate different order numbers with different timestamps', () => {
    const mockDate1 = new Date('2026-01-15T10:20:30.000Z');
    vi.setSystemTime(mockDate1);
    const orderNo1 = generateOrderNo();

    const mockDate2 = new Date('2026-02-20T15:45:50.000Z');
    vi.setSystemTime(mockDate2);
    const orderNo2 = generateOrderNo();

    // Timestamps should be different
    expect(orderNo1.slice(2, 16)).toBe('20260115102030');
    expect(orderNo2.slice(2, 16)).toBe('20260220154550');
    expect(orderNo1).not.toBe(orderNo2);
  });

  it('should generate 6-digit random number within valid range', () => {
    const orderNo = generateOrderNo();

    // Extract random portion (last 6 digits)
    const randomPart = orderNo.slice(16, 22);
    const randomNumber = Number.parseInt(randomPart, 10);

    // Should be between 100000 and 999999 (inclusive)
    expect(randomNumber).toBeGreaterThanOrEqual(100_000);
    expect(randomNumber).toBeLessThanOrEqual(999_999);
    expect(randomPart).toHaveLength(6);
  });

  it('should generate unique order numbers when called multiple times', () => {
    const mockDate = new Date('2026-02-17T10:00:00.000Z');
    vi.setSystemTime(mockDate);

    // Mock Math.random to return different values
    const randomValues = [0.123_456, 0.789_012, 0.456_789];
    let callCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => randomValues[callCount++]!);

    const orderNo1 = generateOrderNo();
    const orderNo2 = generateOrderNo();
    const orderNo3 = generateOrderNo();

    // All order numbers should be different due to different random values
    expect(orderNo1).not.toBe(orderNo2);
    expect(orderNo2).not.toBe(orderNo3);
    expect(orderNo1).not.toBe(orderNo3);

    // All should have the same timestamp prefix
    expect(orderNo1.slice(0, 16)).toBe(orderNo2.slice(0, 16));
    expect(orderNo2.slice(0, 16)).toBe(orderNo3.slice(0, 16));

    // But different random suffixes
    expect(orderNo1.slice(16)).not.toBe(orderNo2.slice(16));
  });

  it('should handle edge case: beginning of year', () => {
    const mockDate = new Date('2026-01-01T00:00:00.000Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();
    const timestamp = orderNo.slice(2, 16);

    expect(timestamp).toBe('20260101000000');
  });

  it('should handle edge case: end of year', () => {
    const mockDate = new Date('2026-12-31T23:59:59.000Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();
    const timestamp = orderNo.slice(2, 16);

    expect(timestamp).toBe('20261231235959');
  });

  it('should pad single-digit months with zero', () => {
    const mockDate = new Date('2026-01-15T10:20:30.000Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();
    const month = orderNo.slice(6, 8);

    expect(month).toBe('01');
  });

  it('should pad single-digit days with zero', () => {
    const mockDate = new Date('2026-02-05T10:20:30.000Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();
    const day = orderNo.slice(8, 10);

    expect(day).toBe('05');
  });

  it('should pad single-digit hours with zero', () => {
    const mockDate = new Date('2026-02-17T03:20:30.000Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();
    const hours = orderNo.slice(10, 12);

    expect(hours).toBe('03');
  });

  it('should pad single-digit minutes with zero', () => {
    const mockDate = new Date('2026-02-17T10:05:30.000Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();
    const minutes = orderNo.slice(12, 14);

    expect(minutes).toBe('05');
  });

  it('should pad single-digit seconds with zero', () => {
    const mockDate = new Date('2026-02-17T10:20:03.000Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();
    const seconds = orderNo.slice(14, 16);

    expect(seconds).toBe('03');
  });

  it('should generate valid order number matching example format', () => {
    // Example from comment: PC202601270930451234567
    const mockDate = new Date('2026-01-27T09:30:45.000Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();

    // Should match the timestamp from the example
    expect(orderNo.slice(0, 16)).toBe('PC20260127093045');

    // Random part should be 6 digits
    expect(orderNo.slice(16, 22)).toMatch(/^\d{6}$/);
  });

  it('should generate order numbers that are sortable by timestamp', () => {
    const mockDate1 = new Date('2026-01-01T00:00:00.000Z');
    vi.setSystemTime(mockDate1);
    const orderNo1 = generateOrderNo();

    const mockDate2 = new Date('2026-01-01T00:00:01.000Z');
    vi.setSystemTime(mockDate2);
    const orderNo2 = generateOrderNo();

    const mockDate3 = new Date('2026-12-31T23:59:59.000Z');
    vi.setSystemTime(mockDate3);
    const orderNo3 = generateOrderNo();

    // When sorted alphabetically, they should be in chronological order
    const sorted = [orderNo3, orderNo1, orderNo2].sort();
    expect(sorted[0]).toBe(orderNo1);
    expect(sorted[1]).toBe(orderNo2);
    expect(sorted[2]).toBe(orderNo3);
  });

  it('should generate statistically unique order numbers', () => {
    const mockDate = new Date('2026-02-17T10:00:00.000Z');
    vi.setSystemTime(mockDate);

    // Generate multiple order numbers and ensure uniqueness
    const orderNumbers = new Set<string>();
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      const orderNo = generateOrderNo();
      orderNumbers.add(orderNo);
    }

    // All generated order numbers should be unique
    // (With 900,000 possible random values, collision probability is very low)
    expect(orderNumbers.size).toBe(iterations);
  });

  it('should handle leap year date correctly', () => {
    // 2024 is a leap year
    const mockDate = new Date('2024-02-29T12:00:00.000Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();
    const datePart = orderNo.slice(2, 10);

    expect(datePart).toBe('20240229');
  });

  it('should generate order number with minimum random value', () => {
    const mockDate = new Date('2026-02-17T10:00:00.000Z');
    vi.setSystemTime(mockDate);

    // Mock Math.random to return 0 (minimum)
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const orderNo = generateOrderNo();
    const randomPart = orderNo.slice(16, 22);

    // Math.floor(100000 + 0 * 900000) = 100000
    expect(randomPart).toBe('100000');
  });

  it('should generate order number with maximum random value', () => {
    const mockDate = new Date('2026-02-17T10:00:00.000Z');
    vi.setSystemTime(mockDate);

    // Mock Math.random to return 0.999999 (close to maximum)
    vi.spyOn(Math, 'random').mockReturnValue(0.999_999);

    const orderNo = generateOrderNo();
    const randomPart = orderNo.slice(16, 22);

    // Math.floor(100000 + 0.999999 * 900000) = Math.floor(999999.1) = 999999
    expect(randomPart).toBe('999999');
  });
});
