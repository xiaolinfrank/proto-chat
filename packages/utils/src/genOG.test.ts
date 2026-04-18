import { describe, expect, it } from 'vitest';

import { formatDescLength, formatTitleLength } from './genOG';

describe('genOG', () => {
  describe('formatTitleLength', () => {
    it('should return short title unchanged', () => {
      expect(formatTitleLength('Short title')).toBe('Short title');
    });

    it('should return title unchanged when exactly 60 chars', () => {
      const title = 'a'.repeat(60);
      expect(formatTitleLength(title)).toBe(title);
    });

    it('should truncate to 57 chars and append ellipsis when over 60 chars', () => {
      const title = 'a'.repeat(61);
      expect(formatTitleLength(title)).toBe('a'.repeat(57) + '...');
    });

    it('should handle empty string', () => {
      expect(formatTitleLength('')).toBe('');
    });

    it('should reduce effective limit by addOnLength', () => {
      const title = 'a'.repeat(55);
      // 55 > 60 - 10 = 50 → truncate to 47 + '...'
      expect(formatTitleLength(title, 10)).toBe('a'.repeat(47) + '...');
    });

    it('should return title unchanged when within adjusted limit', () => {
      const title = 'a'.repeat(40);
      // 40 == 60 - 20 = 40 → not greater than, return as-is
      expect(formatTitleLength(title, 20)).toBe(title);
    });

    it('should handle addOnLength of 0 (default)', () => {
      const title = 'a'.repeat(65);
      expect(formatTitleLength(title, 0)).toBe('a'.repeat(57) + '...');
    });
  });

  describe('formatDescLength', () => {
    it('should return undefined for empty string', () => {
      expect(formatDescLength('')).toBeUndefined();
    });

    it('should truncate description over 160 chars', () => {
      const desc = 'a'.repeat(161);
      expect(formatDescLength(desc)).toBe('a'.repeat(157) + '...');
    });

    it('should return description unchanged when exactly 160 chars', () => {
      const desc = 'a'.repeat(160);
      expect(formatDescLength(desc)).toBe(desc);
    });

    it('should return description unchanged when no tags provided', () => {
      expect(formatDescLength('Short description')).toBe('Short description');
    });

    it('should append tags when they fit within limit', () => {
      const desc = 'Hello World';
      const tags = ['tag1', 'tag2'];
      // tagStr = "tag1, tag2" (10 chars), tagLength = 160 - 11 - 3 = 146
      // 10 <= 146 → no ellipsis appended; newDesc = "Hello Worldtag1, tag2"
      expect(formatDescLength(desc, tags)).toBe('Hello Worldtag1, tag2');
    });

    it('should truncate tags with ellipsis when they exceed available space', () => {
      const desc = 'a'.repeat(155);
      const tags = ['long tag text here'];
      // tagLength = 160 - 155 - 3 = 2; "lo" + "..."
      // newDesc = 155 + 2 + 3 = 160 chars; 160 > 157 → append another "..."
      expect(formatDescLength(desc, tags)).toBe('a'.repeat(155) + 'lo' + '...' + '...');
    });

    it('should handle empty tags array', () => {
      const desc = 'Hello World';
      // tagStr = "", 0 <= tagLength → no ellipsis; newDesc = desc (11 chars) ≤ 157
      expect(formatDescLength(desc, [])).toBe('Hello World');
    });

    it('should return description unchanged when tags are undefined', () => {
      expect(formatDescLength('My description', undefined)).toBe('My description');
    });

    it('should handle single tag that fits exactly at boundary', () => {
      const desc = 'Hi';
      const tags = ['a'.repeat(155)];
      // tagStr = 155 chars, tagLength = 160 - 2 - 3 = 155
      // tagStr.length (155) == tagLength (155) → NOT greater, no '...'
      // newDesc = "Hi" + "a".repeat(155) = 157 chars; 157 <= 157 → return as-is
      expect(formatDescLength(desc, tags)).toBe('Hi' + 'a'.repeat(155));
    });
  });
});
