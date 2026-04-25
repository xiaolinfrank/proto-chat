// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  generateDefaultAvatar,
  generateRandomAvatar,
  isValidAvatar,
} from '../avatar';

describe('avatar utilities', () => {
  describe('generateDefaultAvatar', () => {
    it('should return URL with default style and svg format', () => {
      const result = generateDefaultAvatar('user123');
      expect(result).toBe('https://api.dicebear.com/9.x/bottts/svg?seed=user123');
    });

    it('should use specified style', () => {
      const result = generateDefaultAvatar('user123', 'identicon');
      expect(result).toBe('https://api.dicebear.com/9.x/identicon/svg?seed=user123');
    });

    it('should use specified format png', () => {
      const result = generateDefaultAvatar('user123', 'bottts', 'png');
      expect(result).toBe('https://api.dicebear.com/9.x/bottts/png?seed=user123');
    });

    it('should URL-encode seed with special characters', () => {
      const result = generateDefaultAvatar('user@example.com');
      expect(result).toBe('https://api.dicebear.com/9.x/bottts/svg?seed=user%40example.com');
    });

    it('should URL-encode seed with spaces', () => {
      const result = generateDefaultAvatar('John Doe');
      expect(result).toBe('https://api.dicebear.com/9.x/bottts/svg?seed=John%20Doe');
    });

    it('should handle empty string seed', () => {
      const result = generateDefaultAvatar('');
      expect(result).toBe('https://api.dicebear.com/9.x/bottts/svg?seed=');
    });

    it('should support all avatar styles', () => {
      const styles = ['bottts', 'identicon', 'shapes', 'thumbs', 'initials'] as const;
      for (const style of styles) {
        const result = generateDefaultAvatar('seed', style);
        expect(result).toContain(`/${style}/`);
      }
    });

    it('should URL-encode slashes in seed', () => {
      const result = generateDefaultAvatar('a/b/c');
      expect(result).toBe('https://api.dicebear.com/9.x/bottts/svg?seed=a%2Fb%2Fc');
    });
  });

  describe('generateRandomAvatar', () => {
    it('should return a valid dicebear URL', () => {
      const result = generateRandomAvatar();
      expect(result).toMatch(/^https:\/\/api\.dicebear\.com\/9\.x\/bottts\/svg\?seed=/);
    });

    it('should use specified style', () => {
      const result = generateRandomAvatar('shapes');
      expect(result).toContain('/shapes/svg?seed=');
    });

    it('should return different URLs on subsequent calls', () => {
      const result1 = generateRandomAvatar();
      const result2 = generateRandomAvatar();
      // Seeds are timestamp + random, so they should differ
      expect(result1).not.toBe(result2);
    });

    it('should include a non-empty seed in URL', () => {
      const result = generateRandomAvatar();
      const seedMatch = result.match(/\?seed=(.+)$/);
      expect(seedMatch).not.toBeNull();
      expect(seedMatch![1]).not.toBe('');
    });
  });

  describe('isValidAvatar', () => {
    it('should return true for https:// URLs', () => {
      expect(isValidAvatar('https://example.com/avatar.png')).toBe(true);
    });

    it('should return true for http:// URLs', () => {
      expect(isValidAvatar('http://example.com/avatar.png')).toBe(true);
    });

    it('should return true for relative paths starting with /', () => {
      expect(isValidAvatar('/avatars/user.png')).toBe(true);
    });

    it('should return false for undefined', () => {
      expect(isValidAvatar(undefined)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidAvatar(null)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidAvatar('')).toBe(false);
    });

    it('should return false for plain text without URL scheme', () => {
      expect(isValidAvatar('just-a-string')).toBe(false);
    });

    it('should return false for strings starting with ftp://', () => {
      expect(isValidAvatar('ftp://example.com/avatar.png')).toBe(false);
    });

    it('should return true for DiceBear-generated avatar URLs', () => {
      const avatarUrl = generateDefaultAvatar('user123');
      expect(isValidAvatar(avatarUrl)).toBe(true);
    });
  });
});
