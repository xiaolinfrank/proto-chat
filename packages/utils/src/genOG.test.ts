import { describe, expect, it } from 'vitest';

import { formatDescLength, formatTitleLength } from './genOG';

describe('formatTitleLength', () => {
  it('should return the title unchanged when shorter than 60 chars', () => {
    const title = 'Short title';
    expect(formatTitleLength(title)).toBe('Short title');
  });

  it('should return the title unchanged when exactly 60 chars', () => {
    const title = 'A'.repeat(60);
    expect(formatTitleLength(title)).toBe(title);
  });

  it('should truncate title to 57 chars + ellipsis when longer than 60 chars', () => {
    const title = 'A'.repeat(61);
    expect(formatTitleLength(title)).toBe('A'.repeat(57) + '...');
  });

  it('should account for addOnLength when truncating', () => {
    // With addOnLength=5, threshold is 55, truncation at 52
    const title = 'A'.repeat(56);
    expect(formatTitleLength(title, 5)).toBe('A'.repeat(52) + '...');
  });

  it('should return title unchanged when within threshold with addOnLength', () => {
    const title = 'A'.repeat(50);
    expect(formatTitleLength(title, 5)).toBe(title);
  });

  it('should handle empty string', () => {
    expect(formatTitleLength('')).toBe('');
  });

  it('should handle title exactly at threshold with addOnLength', () => {
    const title = 'A'.repeat(55);
    expect(formatTitleLength(title, 5)).toBe(title);
  });

  it('should truncate title at 61 chars with addOnLength=0 (default)', () => {
    const title = 'B'.repeat(61);
    const result = formatTitleLength(title, 0);
    expect(result).toBe('B'.repeat(57) + '...');
    expect(result).toHaveLength(60);
  });
});

describe('formatDescLength', () => {
  it('should return undefined for empty string', () => {
    expect(formatDescLength('')).toBeUndefined();
  });

  it('should return description unchanged when shorter than 160 chars and no tags', () => {
    const desc = 'Short description';
    expect(formatDescLength(desc)).toBe('Short description');
  });

  it('should return description unchanged when exactly 160 chars and no tags', () => {
    const desc = 'A'.repeat(160);
    expect(formatDescLength(desc)).toBe(desc);
  });

  it('should truncate description to 157 chars + ellipsis when longer than 160 chars', () => {
    const desc = 'A'.repeat(161);
    expect(formatDescLength(desc)).toBe('A'.repeat(157) + '...');
  });

  it('should return description without tags when no tags provided', () => {
    const desc = 'Hello world';
    expect(formatDescLength(desc, undefined)).toBe('Hello world');
  });

  it('should append tags when desc is short enough to fit with tags', () => {
    const desc = 'Hello';
    const tags = ['tag1', 'tag2'];
    const result = formatDescLength(desc, tags);
    // tagStr = 'tag1, tag2' (10 chars)
    // tagLength = 160 - 5 - 3 = 152
    // tagStr fits entirely, so result = 'Hello' + 'tag1, tag2'
    expect(result).toBe('Hellotag1, tag2');
  });

  it('should truncate tags when desc + tags would exceed 160 chars', () => {
    const desc = 'A'.repeat(140);
    const tags = ['tag1234567890', 'tag1234567890'];
    const result = formatDescLength(desc, tags);
    // tagLength = 160 - 140 - 3 = 17
    // tagStr = 'tag1234567890, tag1234567890' (27 chars)
    // tagStr.slice(0, 17) = 'tag1234567890, ta'
    // tagStr.length (27) > tagLength (17), so append '...'
    // newDesc = desc + 'tag1234567890, ta' + '...' = 160 chars
    // newDesc.length (160) > 157, so another '...' is appended
    expect(result).toBe(desc + 'tag1234567890, ta' + '......');
  });

  it('should handle desc longer than 160 chars even with tags provided', () => {
    const desc = 'A'.repeat(161);
    const tags = ['tag1'];
    expect(formatDescLength(desc, tags)).toBe('A'.repeat(157) + '...');
  });

  it('should return empty tags string when tags array is empty', () => {
    const desc = 'Hello';
    const result = formatDescLength(desc, []);
    // tagStr = '', tagLength = 160 - 5 - 3 = 152
    // tagStr.slice(0, 152) = '', tagStr.length (0) <= 152, so no trailing '...'
    // result = 'Hello' + '' = 'Hello', length 5 <= 157
    expect(result).toBe('Hello');
  });

  it('should handle desc with tags that fit exactly in remaining space', () => {
    const desc = 'A'.repeat(100);
    const tags = ['B'.repeat(57)]; // tagStr = 57 chars, tagLength = 160 - 100 - 3 = 57
    const result = formatDescLength(desc, tags);
    // tagStr fits exactly (length 57 === tagLength 57), no trailing '...'
    expect(result).toBe('A'.repeat(100) + 'B'.repeat(57));
  });
});
