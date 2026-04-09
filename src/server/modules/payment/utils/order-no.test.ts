import { describe, expect, it } from 'vitest';

import { generateOrderNo } from './order-no';

describe('generateOrderNo', () => {
  it('should start with "PC" prefix', () => {
    const orderNo = generateOrderNo();
    expect(orderNo.startsWith('PC')).toBe(true);
  });

  it('should have correct total length (PC + 14 timestamp digits + 6 random digits = 22)', () => {
    const orderNo = generateOrderNo();
    expect(orderNo).toHaveLength(22);
  });

  it('should contain only digits after the "PC" prefix', () => {
    const orderNo = generateOrderNo();
    const numericPart = orderNo.slice(2);
    expect(/^\d+$/.test(numericPart)).toBe(true);
  });

  it('should embed a valid timestamp in positions 2-15', () => {
    const before = new Date();
    const orderNo = generateOrderNo();
    const after = new Date();

    const year = Number(orderNo.slice(2, 6));
    const month = Number(orderNo.slice(6, 8));
    const day = Number(orderNo.slice(8, 10));
    const hours = Number(orderNo.slice(10, 12));
    const minutes = Number(orderNo.slice(12, 14));
    const seconds = Number(orderNo.slice(14, 16));

    expect(year).toBeGreaterThanOrEqual(before.getFullYear());
    expect(year).toBeLessThanOrEqual(after.getFullYear());
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
    expect(hours).toBeGreaterThanOrEqual(0);
    expect(hours).toBeLessThanOrEqual(23);
    expect(minutes).toBeGreaterThanOrEqual(0);
    expect(minutes).toBeLessThanOrEqual(59);
    expect(seconds).toBeGreaterThanOrEqual(0);
    expect(seconds).toBeLessThanOrEqual(59);
  });

  it('should have a 6-digit random suffix in range [100000, 999999]', () => {
    const orderNo = generateOrderNo();
    const random = Number(orderNo.slice(16));
    expect(random).toBeGreaterThanOrEqual(100_000);
    expect(random).toBeLessThanOrEqual(999_999);
  });

  it('should generate unique order numbers on consecutive calls', () => {
    const orderNos = new Set(Array.from({ length: 100 }, () => generateOrderNo()));
    // With random suffix there should be no collisions in 100 calls
    expect(orderNos.size).toBe(100);
  });
});
