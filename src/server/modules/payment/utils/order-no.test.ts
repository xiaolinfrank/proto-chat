// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { generateOrderNo } from './order-no';

describe('generateOrderNo', () => {
  it('should return a string starting with PC', () => {
    const orderNo = generateOrderNo();
    expect(orderNo).toMatch(/^PC/);
  });

  it('should have correct total length (PC + 14 date digits + 6 random = 22 chars)', () => {
    const orderNo = generateOrderNo();
    expect(orderNo).toHaveLength(22);
  });

  it('should match expected format: PC + YYYYMMDDHHMMSS + 6 random digits', () => {
    const orderNo = generateOrderNo();
    expect(orderNo).toMatch(/^PC\d{20}$/);
  });

  it('should contain valid year in timestamp portion', () => {
    const before = new Date();
    const orderNo = generateOrderNo();
    const year = parseInt(orderNo.slice(2, 6));
    expect(year).toBeGreaterThanOrEqual(before.getFullYear());
    expect(year).toBeLessThanOrEqual(before.getFullYear() + 1);
  });

  it('should contain valid month (01-12) in timestamp portion', () => {
    const orderNo = generateOrderNo();
    const month = parseInt(orderNo.slice(6, 8));
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
  });

  it('should contain valid day (01-31) in timestamp portion', () => {
    const orderNo = generateOrderNo();
    const day = parseInt(orderNo.slice(8, 10));
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
  });

  it('should contain valid hours (00-23) in timestamp portion', () => {
    const orderNo = generateOrderNo();
    const hours = parseInt(orderNo.slice(10, 12));
    expect(hours).toBeGreaterThanOrEqual(0);
    expect(hours).toBeLessThanOrEqual(23);
  });

  it('should contain valid minutes (00-59) in timestamp portion', () => {
    const orderNo = generateOrderNo();
    const minutes = parseInt(orderNo.slice(12, 14));
    expect(minutes).toBeGreaterThanOrEqual(0);
    expect(minutes).toBeLessThanOrEqual(59);
  });

  it('should contain valid seconds (00-59) in timestamp portion', () => {
    const orderNo = generateOrderNo();
    const seconds = parseInt(orderNo.slice(14, 16));
    expect(seconds).toBeGreaterThanOrEqual(0);
    expect(seconds).toBeLessThanOrEqual(59);
  });

  it('should have random part between 100000 and 999999', () => {
    const orderNo = generateOrderNo();
    const random = parseInt(orderNo.slice(16));
    expect(random).toBeGreaterThanOrEqual(100_000);
    expect(random).toBeLessThanOrEqual(999_999);
  });

  it('should generate unique order numbers across multiple calls', () => {
    const orderNos = new Set(Array.from({ length: 100 }, () => generateOrderNo()));
    // With 6-digit random part (900,000 possibilities), 100 samples should all be unique
    expect(orderNos.size).toBe(100);
  });

  it('should only contain alphanumeric characters', () => {
    const orderNo = generateOrderNo();
    expect(orderNo).toMatch(/^[A-Z0-9]+$/);
  });
});
