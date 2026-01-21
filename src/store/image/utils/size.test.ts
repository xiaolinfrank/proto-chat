import { describe, expect, it } from 'vitest';

import { adaptSizeToRatio, parseRatio } from './size';

describe('size utils', () => {
  describe('parseRatio', () => {
    it('should parse valid ratio strings correctly', () => {
      expect(parseRatio('16:9')).toBeCloseTo(1.778, 2);
      expect(parseRatio('4:3')).toBeCloseTo(1.333, 2);
      expect(parseRatio('1:1')).toBe(1);
      expect(parseRatio('21:9')).toBeCloseTo(2.333, 2);
      expect(parseRatio('9:16')).toBeCloseTo(0.5625, 3);
    });

    it('should handle square ratios', () => {
      expect(parseRatio('1:1')).toBe(1);
      expect(parseRatio('100:100')).toBe(1);
      expect(parseRatio('512:512')).toBe(1);
    });

    it('should handle decimal ratio values', () => {
      expect(parseRatio('1.5:1')).toBe(1.5);
      expect(parseRatio('16.5:9.5')).toBeCloseTo(1.737, 2);
      expect(parseRatio('0.5:0.25')).toBe(2);
    });

    it('should return 1 for invalid ratio formats', () => {
      // Empty or non-string values
      expect(parseRatio('')).toBe(1);
      expect(parseRatio(null as any)).toBe(1);
      expect(parseRatio(undefined as any)).toBe(1);
      expect(parseRatio(123 as any)).toBe(1);
      expect(parseRatio({} as any)).toBe(1);

      // Invalid format
      expect(parseRatio('16')).toBe(1);
      expect(parseRatio('16-9')).toBe(1);
      expect(parseRatio('16/9')).toBe(1);
      expect(parseRatio('16:9:1')).toBe(1);
      expect(parseRatio(':9')).toBe(1);
      expect(parseRatio('16:')).toBe(1);
      expect(parseRatio(':')).toBe(1);
    });

    it('should return 1 for non-numeric ratio parts', () => {
      expect(parseRatio('abc:def')).toBe(1);
      expect(parseRatio('16:abc')).toBe(1);
      expect(parseRatio('abc:9')).toBe(1);
      expect(parseRatio('NaN:NaN')).toBe(1);
    });

    it('should return 1 for zero or negative ratio values', () => {
      expect(parseRatio('0:9')).toBe(1);
      expect(parseRatio('16:0')).toBe(1);
      expect(parseRatio('0:0')).toBe(1);
      expect(parseRatio('-16:9')).toBe(1);
      expect(parseRatio('16:-9')).toBe(1);
      expect(parseRatio('-16:-9')).toBe(1);
    });

    it('should return 1 for infinite or NaN ratio values', () => {
      expect(parseRatio('Infinity:9')).toBe(1);
      expect(parseRatio('16:Infinity')).toBe(1);
      expect(parseRatio('Infinity:Infinity')).toBe(1);
      expect(parseRatio('NaN:9')).toBe(1);
      expect(parseRatio('16:NaN')).toBe(1);
    });

    it('should handle extreme ratio values', () => {
      expect(parseRatio('1000:1')).toBe(1000);
      expect(parseRatio('1:1000')).toBe(0.001);
      expect(parseRatio('9999:1')).toBe(9999);
    });

    it('should handle whitespace in ratio strings', () => {
      // Whitespace should cause parsing to fail since Number(' 16 ') would work
      // but we want to test actual behavior
      const result1 = parseRatio(' 16:9 ');
      const result2 = parseRatio('16 : 9');
      const result3 = parseRatio(' 16 : 9 ');

      // Number() handles leading/trailing whitespace, so these should work
      expect(result1).toBeCloseTo(1.778, 2);

      // But spaces around colon won't work as split(':') creates ' 9' which Number handles
      expect(result2).toBeCloseTo(1.778, 2);
      expect(result3).toBeCloseTo(1.778, 2);
    });
  });

  describe('adaptSizeToRatio', () => {
    describe('valid inputs', () => {
      it('should preserve width when target ratio is wider than current ratio', () => {
        // Current ratio: 1024/768 = 1.333
        // Target ratio: 16/9 = 1.778 (wider)
        // Should keep width=1024, adjust height
        const result = adaptSizeToRatio(16 / 9, 1024, 768);
        expect(result.width).toBe(1024);
        expect(result.height).toBe(Math.round(1024 / (16 / 9)));
        expect(result.height).toBe(576);
      });

      it('should preserve height when target ratio is taller than current ratio', () => {
        // Current ratio: 1024/768 = 1.333
        // Target ratio: 1:1 = 1.0 (taller)
        // Should keep height=768, adjust width
        const result = adaptSizeToRatio(1, 1024, 768);
        expect(result.height).toBe(768);
        expect(result.width).toBe(Math.round(768 * 1));
        expect(result.width).toBe(768);
      });

      it('should handle square target ratio (1:1)', () => {
        const result = adaptSizeToRatio(1, 1920, 1080);
        expect(result.width).toBe(1080);
        expect(result.height).toBe(1080);
      });

      it('should handle already matching ratio', () => {
        // Current: 1920/1080 = 1.778
        // Target: 16/9 = 1.778
        const currentRatio = 1920 / 1080;
        const targetRatio = 16 / 9;

        const result = adaptSizeToRatio(targetRatio, 1920, 1080);

        // Since ratios are equal, it should take the else branch
        // and adjust width based on height
        expect(result.height).toBe(1080);
        expect(result.width).toBe(Math.round(1080 * targetRatio));
      });

      it('should handle ultra-wide ratios (21:9)', () => {
        const result = adaptSizeToRatio(21 / 9, 1920, 1080);
        expect(result.width).toBe(1920);
        expect(result.height).toBe(Math.round(1920 / (21 / 9)));
        expect(result.height).toBe(823);
      });

      it('should handle portrait ratios (9:16)', () => {
        const result = adaptSizeToRatio(9 / 16, 1080, 1920);
        expect(result.height).toBe(1920);
        expect(result.width).toBe(Math.round(1920 * (9 / 16)));
        expect(result.width).toBe(1080);
      });

      it('should handle small dimensions', () => {
        const result = adaptSizeToRatio(16 / 9, 256, 256);
        expect(result.width).toBe(256);
        expect(result.height).toBe(Math.round(256 / (16 / 9)));
        expect(result.height).toBe(144);
      });

      it('should handle large dimensions', () => {
        const result = adaptSizeToRatio(16 / 9, 4096, 4096);
        expect(result.width).toBe(4096);
        expect(result.height).toBe(Math.round(4096 / (16 / 9)));
        expect(result.height).toBe(2304);
      });

      it('should round dimensions to nearest integer', () => {
        // Test case that would produce non-integer dimensions
        const result = adaptSizeToRatio(1.5, 100, 100);
        expect(Number.isInteger(result.width)).toBe(true);
        expect(Number.isInteger(result.height)).toBe(true);
      });

      it('should handle decimal ratio values', () => {
        const result = adaptSizeToRatio(1.333, 1920, 1080);
        expect(result.height).toBe(1080);
        expect(result.width).toBe(Math.round(1080 * 1.333));
        expect(result.width).toBe(1440);
      });

      it('should handle extreme wide ratios', () => {
        const result = adaptSizeToRatio(10, 1000, 1000);
        expect(result.width).toBe(1000);
        expect(result.height).toBe(Math.round(1000 / 10));
        expect(result.height).toBe(100);
      });

      it('should handle extreme tall ratios', () => {
        const result = adaptSizeToRatio(0.1, 1000, 1000);
        expect(result.height).toBe(1000);
        expect(result.width).toBe(Math.round(1000 * 0.1));
        expect(result.width).toBe(100);
      });
    });

    describe('invalid inputs - ratio parameter', () => {
      it('should throw error for zero ratio', () => {
        expect(() => adaptSizeToRatio(0, 1920, 1080)).toThrow(
          'Invalid ratio: must be a positive finite number',
        );
      });

      it('should throw error for negative ratio', () => {
        expect(() => adaptSizeToRatio(-1.5, 1920, 1080)).toThrow(
          'Invalid ratio: must be a positive finite number',
        );
      });

      it('should throw error for infinite ratio', () => {
        expect(() => adaptSizeToRatio(Infinity, 1920, 1080)).toThrow(
          'Invalid ratio: must be a positive finite number',
        );
        expect(() => adaptSizeToRatio(-Infinity, 1920, 1080)).toThrow(
          'Invalid ratio: must be a positive finite number',
        );
      });

      it('should throw error for NaN ratio', () => {
        expect(() => adaptSizeToRatio(NaN, 1920, 1080)).toThrow(
          'Invalid ratio: must be a positive finite number',
        );
      });
    });

    describe('invalid inputs - defaultWidth parameter', () => {
      it('should throw error for zero defaultWidth', () => {
        expect(() => adaptSizeToRatio(16 / 9, 0, 1080)).toThrow(
          'Invalid defaultWidth: must be a positive finite number',
        );
      });

      it('should throw error for negative defaultWidth', () => {
        expect(() => adaptSizeToRatio(16 / 9, -1920, 1080)).toThrow(
          'Invalid defaultWidth: must be a positive finite number',
        );
      });

      it('should throw error for infinite defaultWidth', () => {
        expect(() => adaptSizeToRatio(16 / 9, Infinity, 1080)).toThrow(
          'Invalid defaultWidth: must be a positive finite number',
        );
      });

      it('should throw error for NaN defaultWidth', () => {
        expect(() => adaptSizeToRatio(16 / 9, NaN, 1080)).toThrow(
          'Invalid defaultWidth: must be a positive finite number',
        );
      });
    });

    describe('invalid inputs - defaultHeight parameter', () => {
      it('should throw error for zero defaultHeight', () => {
        expect(() => adaptSizeToRatio(16 / 9, 1920, 0)).toThrow(
          'Invalid defaultHeight: must be a positive finite number',
        );
      });

      it('should throw error for negative defaultHeight', () => {
        expect(() => adaptSizeToRatio(16 / 9, 1920, -1080)).toThrow(
          'Invalid defaultHeight: must be a positive finite number',
        );
      });

      it('should throw error for infinite defaultHeight', () => {
        expect(() => adaptSizeToRatio(16 / 9, 1920, Infinity)).toThrow(
          'Invalid defaultHeight: must be a positive finite number',
        );
      });

      it('should throw error for NaN defaultHeight', () => {
        expect(() => adaptSizeToRatio(16 / 9, 1920, NaN)).toThrow(
          'Invalid defaultHeight: must be a positive finite number',
        );
      });
    });

    describe('edge cases', () => {
      it('should handle very small ratio values', () => {
        const result = adaptSizeToRatio(0.001, 1000, 1000);
        expect(result.height).toBe(1000);
        expect(result.width).toBe(Math.round(1000 * 0.001));
        expect(result.width).toBe(1);
      });

      it('should handle very large ratio values', () => {
        const result = adaptSizeToRatio(1000, 1000, 1000);
        expect(result.width).toBe(1000);
        expect(result.height).toBe(Math.round(1000 / 1000));
        expect(result.height).toBe(1);
      });

      it('should handle minimum positive values', () => {
        const result = adaptSizeToRatio(1, 1, 1);
        expect(result.width).toBe(1);
        expect(result.height).toBe(1);
      });

      it('should maintain aspect ratio accuracy', () => {
        const targetRatio = 16 / 9;
        const result = adaptSizeToRatio(targetRatio, 1920, 1080);

        // Verify the resulting dimensions maintain the target ratio
        // (with rounding tolerance)
        const resultRatio = result.width / result.height;
        expect(Math.abs(resultRatio - targetRatio)).toBeLessThan(0.01);
      });
    });
  });
});
