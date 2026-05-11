import { describe, expect, it, vi } from 'vitest';

import { generateOrderNo } from './order-no';

describe('generateOrderNo', () => {
  it('should return a string', () => {
    expect(typeof generateOrderNo()).toBe('string');
  });

  it('should always start with the "PC" prefix', () => {
    for (let i = 0; i < 10; i++) {
      expect(generateOrderNo()).toMatch(/^PC/);
    }
  });

  it('should have the correct total length (PC + 14 timestamp digits + 6 random digits = 22)', () => {
    const orderNo = generateOrderNo();
    expect(orderNo).toHaveLength(22);
  });

  it('should match the expected format PC + YYYYMMDDHHMMSS + 6-digit random', () => {
    const orderNo = generateOrderNo();
    // PC, then 14 digits (date+time), then 6 digits (random)
    expect(orderNo).toMatch(/^PC\d{14}\d{6}$/);
  });

  it('should embed a valid date in the timestamp portion', () => {
    const before = new Date();
    const orderNo = generateOrderNo();
    const after = new Date();

    // Extract the timestamp segment: chars 2–15 (14 chars)
    const ts = orderNo.slice(2, 16);
    const year = parseInt(ts.slice(0, 4), 10);
    const month = parseInt(ts.slice(4, 6), 10);
    const day = parseInt(ts.slice(6, 8), 10);

    expect(year).toBeGreaterThanOrEqual(before.getFullYear());
    expect(year).toBeLessThanOrEqual(after.getFullYear());
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
  });

  it('should embed a valid 6-digit random suffix (100000–999999)', () => {
    const orderNo = generateOrderNo();
    const randomPart = parseInt(orderNo.slice(16), 10);
    expect(randomPart).toBeGreaterThanOrEqual(100_000);
    expect(randomPart).toBeLessThanOrEqual(999_999);
  });

  it('should generate unique order numbers on successive calls', () => {
    const results = new Set(Array.from({ length: 100 }, () => generateOrderNo()));
    // With random 6-digit suffix the probability of all 100 being identical is negligible
    expect(results.size).toBeGreaterThan(1);
  });

  it('should produce a deterministic format for a fixed date and random value', () => {
    const fixedDate = new Date('2026-01-27T09:30:45.000Z');
    vi.setSystemTime(fixedDate);
    vi.spyOn(Math, 'random').mockReturnValue(0); // Math.floor(100000 + 0 * 900000) = 100000

    const orderNo = generateOrderNo();

    vi.useRealTimers();
    vi.restoreAllMocks();

    expect(orderNo).toMatch(/^PC\d{14}100000$/);
    expect(orderNo.startsWith('PC')).toBe(true);
  });
});
