// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { generateOrderNo } from './order-no';

describe('generateOrderNo', () => {
  it('should return a string starting with "PC"', () => {
    const orderNo = generateOrderNo();
    expect(orderNo.startsWith('PC')).toBe(true);
  });

  it('should have total length of 22 characters (PC + 14-digit timestamp + 6-digit random)', () => {
    const orderNo = generateOrderNo();
    expect(orderNo).toHaveLength(22);
  });

  it('should match format: PC followed by 20 digits', () => {
    const orderNo = generateOrderNo();
    expect(orderNo).toMatch(/^PC\d{20}$/);
  });

  it('should include a valid year in the timestamp', () => {
    const before = new Date();
    const orderNo = generateOrderNo();
    const after = new Date();

    const year = Number.parseInt(orderNo.slice(2, 6), 10);
    expect(year).toBeGreaterThanOrEqual(before.getFullYear());
    expect(year).toBeLessThanOrEqual(after.getFullYear());
  });

  it('should have a valid month (01-12) in the timestamp', () => {
    const orderNo = generateOrderNo();
    const month = Number.parseInt(orderNo.slice(6, 8), 10);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
  });

  it('should have a valid day (01-31) in the timestamp', () => {
    const orderNo = generateOrderNo();
    const day = Number.parseInt(orderNo.slice(8, 10), 10);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
  });

  it('should have valid hours (00-23) in the timestamp', () => {
    const orderNo = generateOrderNo();
    const hours = Number.parseInt(orderNo.slice(10, 12), 10);
    expect(hours).toBeGreaterThanOrEqual(0);
    expect(hours).toBeLessThanOrEqual(23);
  });

  it('should have valid minutes (00-59) in the timestamp', () => {
    const orderNo = generateOrderNo();
    const minutes = Number.parseInt(orderNo.slice(12, 14), 10);
    expect(minutes).toBeGreaterThanOrEqual(0);
    expect(minutes).toBeLessThanOrEqual(59);
  });

  it('should have valid seconds (00-59) in the timestamp', () => {
    const orderNo = generateOrderNo();
    const seconds = Number.parseInt(orderNo.slice(14, 16), 10);
    expect(seconds).toBeGreaterThanOrEqual(0);
    expect(seconds).toBeLessThanOrEqual(59);
  });

  it('should have a 6-digit random suffix between 100000 and 999999', () => {
    const orderNo = generateOrderNo();
    const randomPart = Number.parseInt(orderNo.slice(16, 22), 10);
    expect(randomPart).toBeGreaterThanOrEqual(100_000);
    expect(randomPart).toBeLessThanOrEqual(999_999);
  });

  it('should generate unique order numbers across multiple calls', () => {
    const orderNos = Array.from({ length: 100 }, () => generateOrderNo());
    const uniqueSet = new Set(orderNos);
    // Due to random suffix, each generated order number should be unique
    expect(uniqueSet.size).toBe(100);
  });

  it('should pad month with leading zero when single digit', () => {
    // We can verify the format is consistent (2-digit month) by checking
    // the month portion is always 2 characters
    const orderNo = generateOrderNo();
    const monthStr = orderNo.slice(6, 8);
    expect(monthStr).toMatch(/^\d{2}$/);
  });

  it('should pad day with leading zero when single digit', () => {
    const orderNo = generateOrderNo();
    const dayStr = orderNo.slice(8, 10);
    expect(dayStr).toMatch(/^\d{2}$/);
  });

  it('should pad hours with leading zero when single digit', () => {
    const orderNo = generateOrderNo();
    const hoursStr = orderNo.slice(10, 12);
    expect(hoursStr).toMatch(/^\d{2}$/);
  });

  it('should pad minutes with leading zero when single digit', () => {
    const orderNo = generateOrderNo();
    const minutesStr = orderNo.slice(12, 14);
    expect(minutesStr).toMatch(/^\d{2}$/);
  });

  it('should pad seconds with leading zero when single digit', () => {
    const orderNo = generateOrderNo();
    const secondsStr = orderNo.slice(14, 16);
    expect(secondsStr).toMatch(/^\d{2}$/);
  });
});
