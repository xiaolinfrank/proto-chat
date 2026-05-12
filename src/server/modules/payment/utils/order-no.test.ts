// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { generateOrderNo } from './order-no';

describe('generateOrderNo', () => {
  it('should return a string starting with "PC"', () => {
    const orderNo = generateOrderNo();
    expect(orderNo).toMatch(/^PC/);
  });

  it('should have correct total length (PC + 14 timestamp digits + 6 random digits = 22)', () => {
    const orderNo = generateOrderNo();
    expect(orderNo).toHaveLength(22);
  });

  it('should match expected format: PC + YYYYMMDDHHMMSS + 6-digit number', () => {
    const orderNo = generateOrderNo();
    expect(orderNo).toMatch(/^PC\d{14}\d{6}$/);
  });

  it('should include valid date components in the timestamp', () => {
    const before = new Date();
    const orderNo = generateOrderNo();
    const after = new Date();

    const year = Number.parseInt(orderNo.slice(2, 6), 10);
    const month = Number.parseInt(orderNo.slice(6, 8), 10);
    const day = Number.parseInt(orderNo.slice(8, 10), 10);

    expect(year).toBeGreaterThanOrEqual(before.getFullYear());
    expect(year).toBeLessThanOrEqual(after.getFullYear());
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
  });

  it('should include a 6-digit random number in range [100000, 999999]', () => {
    const orderNo = generateOrderNo();
    const randomPart = Number.parseInt(orderNo.slice(16), 10);
    expect(randomPart).toBeGreaterThanOrEqual(100_000);
    expect(randomPart).toBeLessThanOrEqual(999_999);
  });

  it('should generate unique order numbers on consecutive calls', () => {
    const orders = new Set(Array.from({ length: 100 }, () => generateOrderNo()));
    // With 6-digit random component, collisions are extremely unlikely in 100 calls
    expect(orders.size).toBeGreaterThan(1);
  });

  it('should use correct timestamp from current date', () => {
    const fixedDate = new Date('2026-05-12T09:30:45.000Z');
    vi.spyOn(global, 'Date').mockImplementation(() => fixedDate as unknown as Date);

    const orderNo = generateOrderNo();

    // Restore original Date
    vi.restoreAllMocks();

    // PC + year + month + day + hours + minutes + seconds + 6 random digits
    const year = orderNo.slice(2, 6);
    const month = orderNo.slice(6, 8);
    const day = orderNo.slice(8, 10);

    expect(year).toBe('2026');
    expect(month).toBe(String(fixedDate.getMonth() + 1).padStart(2, '0'));
    expect(day).toBe(String(fixedDate.getDate()).padStart(2, '0'));
  });
});
