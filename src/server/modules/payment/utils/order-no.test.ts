// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateOrderNo } from './order-no';

describe('generateOrderNo', () => {
  beforeEach(() => {
    // Reset time mocks before each test
    vi.useRealTimers();
  });

  it('should generate order number with correct format', () => {
    const orderNo = generateOrderNo();

    // Should start with 'PC'
    expect(orderNo).toMatch(/^PC/);

    // Should have correct length: PC (2) + timestamp (14) + random (6) = 22
    expect(orderNo).toHaveLength(22);

    // Should match full format pattern: PC + 14 digits + 6 digits
    expect(orderNo).toMatch(/^PC\d{14}\d{6}$/);
  });

  it('should include current timestamp in order number', () => {
    const mockDate = new Date('2026-01-27T09:30:45.123Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();

    // Expected timestamp: 20260127093045 (YYYYMMDDHHMMSS)
    expect(orderNo).toContain('20260127093045');
    expect(orderNo).toMatch(/^PC20260127093045\d{6}$/);
  });

  it('should generate random 6-digit number in valid range', () => {
    const orderNo = generateOrderNo();

    // Extract the random part (last 6 digits)
    const randomPart = orderNo.slice(-6);
    const randomNumber = Number.parseInt(randomPart, 10);

    // Should be between 100000 and 999999 (inclusive)
    expect(randomNumber).toBeGreaterThanOrEqual(100_000);
    expect(randomNumber).toBeLessThanOrEqual(999_999);
  });

  it('should pad single-digit month with zero', () => {
    // Test with January (month 1)
    const mockDate = new Date('2026-01-15T12:00:00Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();

    // Month should be padded as '01'
    expect(orderNo).toContain('202601');
  });

  it('should pad single-digit day with zero', () => {
    // Test with day 5
    const mockDate = new Date('2026-02-05T12:00:00Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();

    // Day should be padded as '05'
    expect(orderNo).toContain('20260205');
  });

  it('should pad single-digit hours with zero', () => {
    // Test with hour 3
    const mockDate = new Date('2026-01-15T03:30:00Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();

    // Hours should be padded as '03'
    expect(orderNo).toMatch(/PC\d{8}03\d{4}\d{6}$/);
  });

  it('should pad single-digit minutes with zero', () => {
    // Test with minute 7
    const mockDate = new Date('2026-01-15T12:07:00Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();

    // Minutes should be padded as '07'
    expect(orderNo).toMatch(/PC\d{10}07\d{2}\d{6}$/);
  });

  it('should pad single-digit seconds with zero', () => {
    // Test with second 9
    const mockDate = new Date('2026-01-15T12:30:09Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();

    // Seconds should be padded as '09'
    expect(orderNo).toMatch(/PC\d{12}09\d{6}$/);
  });

  it('should generate unique order numbers when called multiple times', () => {
    const orderNumbers = new Set<string>();
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      orderNumbers.add(generateOrderNo());
    }

    // All order numbers should be unique due to random component
    // (extremely unlikely to get duplicates with 6-digit random range)
    expect(orderNumbers.size).toBe(iterations);
  });

  it('should handle year change correctly', () => {
    // Test with year 2030
    const mockDate = new Date('2030-12-31T23:59:59Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();

    // Should contain year 2030
    expect(orderNo).toContain('2030');
    expect(orderNo).toMatch(/^PC20301231235959\d{6}$/);
  });

  it('should handle leap year February correctly', () => {
    // 2024 is a leap year, February 29th
    const mockDate = new Date('2024-02-29T12:00:00Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();

    // Should handle Feb 29th correctly
    expect(orderNo).toContain('20240229');
  });

  it('should handle end of month correctly', () => {
    // Test with March 31st
    const mockDate = new Date('2026-03-31T23:59:59Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();

    // Should handle day 31 correctly
    expect(orderNo).toContain('20260331235959');
  });

  it('should generate different order numbers at different times', () => {
    const mockDate1 = new Date('2026-01-15T10:00:00Z');
    vi.setSystemTime(mockDate1);
    const orderNo1 = generateOrderNo();

    const mockDate2 = new Date('2026-01-15T10:00:01Z');
    vi.setSystemTime(mockDate2);
    const orderNo2 = generateOrderNo();

    // Different timestamps should result in different order numbers
    expect(orderNo1).not.toBe(orderNo2);
  });

  it('should match the documented example format', () => {
    // From the comment: Example: PC202601270930451234567
    const mockDate = new Date('2026-01-27T09:30:45Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();

    // Should match the format (random part will differ)
    expect(orderNo).toMatch(/^PC20260127093045\d{6}$/);
  });

  it('should handle midnight time correctly', () => {
    const mockDate = new Date('2026-05-10T00:00:00Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();

    // Should pad midnight time as 000000
    expect(orderNo).toContain('20260510000000');
  });

  it('should handle double-digit values without extra padding', () => {
    // All values are double-digit
    const mockDate = new Date('2026-11-25T15:45:30Z');
    vi.setSystemTime(mockDate);

    const orderNo = generateOrderNo();

    // Should not add extra padding to already double-digit values
    expect(orderNo).toMatch(/^PC20261125154530\d{6}$/);
  });
});
