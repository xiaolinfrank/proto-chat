// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { generateOrderNo } from './order-no';

describe('generateOrderNo', () => {
  it('should start with PC prefix', () => {
    const orderNo = generateOrderNo();
    expect(orderNo).toMatch(/^PC/);
  });

  it('should have correct total length (PC + 14 timestamp digits + 6 random digits)', () => {
    const orderNo = generateOrderNo();
    // 'PC' (2) + YYYYMMDDHHMMSS (14) + 6-digit random = 22 chars
    expect(orderNo).toHaveLength(22);
  });

  it('should match expected format: PC followed by 20 digits', () => {
    const orderNo = generateOrderNo();
    expect(orderNo).toMatch(/^PC\d{20}$/);
  });

  it('should include a valid timestamp in the order number', () => {
    const before = new Date();
    const orderNo = generateOrderNo();
    const after = new Date();

    // Extract timestamp portion (after 'PC', first 14 chars)
    const timestampStr = orderNo.slice(2, 16);
    const year = Number(timestampStr.slice(0, 4));
    const month = Number(timestampStr.slice(4, 6)) - 1;
    const day = Number(timestampStr.slice(6, 8));
    const hours = Number(timestampStr.slice(8, 10));
    const minutes = Number(timestampStr.slice(10, 12));
    const seconds = Number(timestampStr.slice(12, 14));

    const orderDate = new Date(year, month, day, hours, minutes, seconds);

    // Allow 1 second tolerance
    expect(orderDate.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(orderDate.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);
  });

  it('should include a 6-digit random suffix', () => {
    const orderNo = generateOrderNo();
    const randomPart = orderNo.slice(16); // last 6 chars
    const randomNum = Number(randomPart);
    expect(randomNum).toBeGreaterThanOrEqual(100_000);
    expect(randomNum).toBeLessThanOrEqual(999_999);
  });

  it('should generate mostly unique order numbers across multiple calls', () => {
    const orderNos = new Set<string>();
    for (let i = 0; i < 50; i++) {
      orderNos.add(generateOrderNo());
    }
    // 50 numbers should be mostly unique
    expect(orderNos.size).toBeGreaterThan(45);
  });
});
