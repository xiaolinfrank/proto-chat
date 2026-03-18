import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCompress, mockDecompress } = vi.hoisted(() => {
  const mockCompress = vi.fn((buf: Uint8Array) => {
    // Simple mock: return the input with a prefix byte to simulate compression
    const result = new Uint8Array(buf.length + 1);
    result[0] = 0xff; // marker byte
    result.set(buf, 1);
    return result;
  });

  const mockDecompress = vi.fn((buf: Uint8Array) => {
    // Reverse the mock compress: strip the prefix byte
    return buf.slice(1);
  });

  return { mockCompress, mockDecompress };
});

vi.mock('brotli-wasm', () => ({
  default: Promise.resolve({
    compress: mockCompress,
    decompress: mockDecompress,
  }),
}));

import { Compressor, StrCompressor } from './compass';

describe('StrCompressor', () => {
  describe('init', () => {
    it('should initialize the brotli instance', async () => {
      const compressor = new StrCompressor();
      await compressor.init();
      // After init, compress/decompress should work
      expect(() => compressor.compress('test')).not.toThrow();
    });
  });

  describe('compress and decompress (sync)', () => {
    let compressor: StrCompressor;

    beforeEach(async () => {
      compressor = new StrCompressor();
      await compressor.init();
      mockCompress.mockClear();
      mockDecompress.mockClear();
    });

    it('should compress a string and return a URL-safe base64 string', () => {
      const result = compressor.compress('hello world');

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // URL-safe base64 should not contain '+' or '/'
      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
    });

    it('should decompress back to the original string', () => {
      const original = 'hello world';
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });

    it('should handle empty string', () => {
      const original = '';
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });

    it('should handle Unicode strings', () => {
      const original = '你好世界 🌍 日本語';
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });

    it('should handle long strings', () => {
      const original = 'a'.repeat(1000);
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });

    it('should handle special characters', () => {
      const original = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`"\'\\';
      const compressed = compressor.compress(original);
      const decompressed = compressor.decompress(compressed);

      expect(decompressed).toBe(original);
    });

    it('should call the brotli instance compress method', () => {
      compressor.compress('test');
      expect(mockCompress).toHaveBeenCalledOnce();
    });

    it('should call the brotli instance decompress method', () => {
      const compressed = compressor.compress('test');
      compressor.decompress(compressed);
      expect(mockDecompress).toHaveBeenCalledOnce();
    });
  });

  describe('compressAsync and decompressAsync', () => {
    let compressor: StrCompressor;

    beforeEach(() => {
      compressor = new StrCompressor();
    });

    it('should compress a string asynchronously', async () => {
      const result = await compressor.compressAsync('hello world');

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // URL-safe base64 should not contain '+' or '/'
      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
    });

    it('should decompress asynchronously back to original', async () => {
      const original = 'hello world';
      const compressed = await compressor.compressAsync(original);
      const decompressed = await compressor.decompressAsync(compressed);

      expect(decompressed).toBe(original);
    });

    it('should handle empty string asynchronously', async () => {
      const original = '';
      const compressed = await compressor.compressAsync(original);
      const decompressed = await compressor.decompressAsync(compressed);

      expect(decompressed).toBe(original);
    });

    it('should handle Unicode strings asynchronously', async () => {
      const original = '中文 🎉 テスト';
      const compressed = await compressor.compressAsync(original);
      const decompressed = await compressor.decompressAsync(compressed);

      expect(decompressed).toBe(original);
    });

    it('should produce consistent results for the same input', async () => {
      const input = 'consistent test';
      const result1 = await compressor.compressAsync(input);
      const result2 = await compressor.compressAsync(input);

      expect(result1).toBe(result2);
    });

    it('should produce different outputs for different inputs', async () => {
      const result1 = await compressor.compressAsync('input one');
      const result2 = await compressor.compressAsync('input two');

      expect(result1).not.toBe(result2);
    });
  });

  describe('URL-safe base64 encoding', () => {
    let compressor: StrCompressor;

    beforeEach(async () => {
      compressor = new StrCompressor();
      await compressor.init();
    });

    it('should not contain standard base64 padding characters in output', () => {
      // The URL-safe encoder strips trailing '='
      const result = compressor.compress('test');
      expect(result).not.toMatch(/=+$/);
    });

    it('should produce output without standard base64 special chars', () => {
      const result = compressor.compress('hello world');
      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
      expect(result).not.toContain('=');
    });

    it('should correctly round-trip data for various inputs', () => {
      const inputs = ['test string 1', 'another test', '12345', 'abcdefghij'];
      for (const input of inputs) {
        const compressed = compressor.compress(input);
        const decompressed = compressor.decompress(compressed);
        expect(decompressed).toBe(input);
      }
    });

    it('should correctly handle base64 padding for various input lengths', () => {
      // Test various lengths that result in different padding needs (0, 1, 2 padding chars)
      const inputs = ['a', 'ab', 'abc', 'abcd', 'abcde'];
      for (const input of inputs) {
        const compressed = compressor.compress(input);
        const decompressed = compressor.decompress(compressed);
        expect(decompressed).toBe(input);
      }
    });
  });

  describe('Compressor singleton', () => {
    it('should be an instance of StrCompressor', () => {
      expect(Compressor).toBeInstanceOf(StrCompressor);
    });

    it('should be able to compress and decompress after init', async () => {
      await Compressor.init();
      const original = 'singleton test';
      const compressed = Compressor.compress(original);
      const decompressed = Compressor.decompress(compressed);
      expect(decompressed).toBe(original);
    });

    it('should support async compress/decompress without prior init', async () => {
      const original = 'async singleton test';
      const compressed = await Compressor.compressAsync(original);
      const decompressed = await Compressor.decompressAsync(compressed);
      expect(decompressed).toBe(original);
    });
  });
});
