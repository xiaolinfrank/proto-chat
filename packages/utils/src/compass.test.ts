import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Compressor, StrCompressor } from './compass';

const mockBrotli = vi.hoisted(() => ({
  compress: vi.fn((data: Uint8Array) => data),
  decompress: vi.fn((data: Uint8Array) => data),
}));

vi.mock('brotli-wasm', () => ({
  default: Promise.resolve(mockBrotli),
}));

describe('StrCompressor', () => {
  let compressor: StrCompressor;

  beforeEach(() => {
    compressor = new StrCompressor();
    vi.clearAllMocks();
    mockBrotli.compress.mockImplementation((data: Uint8Array) => data);
    mockBrotli.decompress.mockImplementation((data: Uint8Array) => data);
  });

  describe('init', () => {
    it('should initialize the brotli instance', async () => {
      await compressor.init();
      // After init, compress/decompress should work without errors
      expect(() => compressor.compress('test')).not.toThrow();
    });
  });

  describe('compress / decompress (synchronous)', () => {
    beforeEach(async () => {
      await compressor.init();
    });

    it('should compress and decompress a simple string', () => {
      const input = 'hello world';
      const compressed = compressor.compress(input);
      const decompressed = compressor.decompress(compressed);
      expect(decompressed).toBe(input);
    });

    it('should produce URL-safe output (no +, /, or = characters)', () => {
      const input = 'test string for URL safety';
      const compressed = compressor.compress(input);
      expect(compressed).not.toContain('+');
      expect(compressed).not.toContain('/');
      expect(compressed).not.toContain('=');
    });

    it('should handle empty string round-trip', () => {
      const input = '';
      const compressed = compressor.compress(input);
      const decompressed = compressor.decompress(compressed);
      expect(decompressed).toBe(input);
    });

    it('should handle unicode characters round-trip', () => {
      const input = '中文测试 日本語 한국어';
      const compressed = compressor.compress(input);
      const decompressed = compressor.decompress(compressed);
      expect(decompressed).toBe(input);
    });

    it('should handle special characters round-trip', () => {
      const input = '!@#$%^&*()_+-=[]{}|;\':",.<>?/`~';
      const compressed = compressor.compress(input);
      const decompressed = compressor.decompress(compressed);
      expect(decompressed).toBe(input);
    });

    it('should pass input bytes through brotli compress', () => {
      compressor.compress('hello');
      expect(mockBrotli.compress).toHaveBeenCalledOnce();
      const callArg = mockBrotli.compress.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(Uint8Array);
    });

    it('should replace + with _0_ in URL-safe encoding', () => {
      // Bytes [0xFB, 0xEF, 0x00] produce '++8A' in standard base64
      mockBrotli.compress.mockReturnValueOnce(new Uint8Array([0xfb, 0xef, 0x00]));
      const compressed = compressor.compress('any');
      expect(compressed).not.toContain('+');
      expect(compressed).toContain('_0_');
    });

    it('should replace / with _ in URL-safe encoding', () => {
      // Bytes [0xFF, 0xFC, 0x00] produce '//AA' in standard base64
      mockBrotli.compress.mockReturnValueOnce(new Uint8Array([0xff, 0xfc, 0x00]));
      const compressed = compressor.compress('any');
      expect(compressed).not.toContain('/');
    });

    it('should correctly decode _0_ back to + for decompression', () => {
      // Bytes that produce + in base64
      mockBrotli.compress.mockReturnValueOnce(new Uint8Array([0xfb, 0xef, 0x00]));
      mockBrotli.decompress.mockImplementation((data: Uint8Array) => data);
      const compressed = compressor.compress('any');

      // Now decompress - the _0_ should be decoded back to + before atob
      expect(() => compressor.decompress(compressed)).not.toThrow();
    });

    it('should handle long strings', () => {
      const input = 'a'.repeat(10_000);
      const compressed = compressor.compress(input);
      const decompressed = compressor.decompress(compressed);
      expect(decompressed).toBe(input);
    });
  });

  describe('compressAsync / decompressAsync', () => {
    it('should compress and decompress asynchronously', async () => {
      const input = 'async hello world';
      const compressed = await compressor.compressAsync(input);
      const decompressed = await compressor.decompressAsync(compressed);
      expect(decompressed).toBe(input);
    });

    it('should produce URL-safe output asynchronously', async () => {
      const input = 'test async URL safety';
      const compressed = await compressor.compressAsync(input);
      expect(compressed).not.toContain('+');
      expect(compressed).not.toContain('/');
      expect(compressed).not.toContain('=');
    });

    it('should handle empty string asynchronously', async () => {
      const input = '';
      const compressed = await compressor.compressAsync(input);
      const decompressed = await compressor.decompressAsync(compressed);
      expect(decompressed).toBe(input);
    });

    it('should handle unicode strings asynchronously', async () => {
      const input = '中文测试 emoji 🎉';
      const compressed = await compressor.compressAsync(input);
      const decompressed = await compressor.decompressAsync(compressed);
      expect(decompressed).toBe(input);
    });

    it('should pass input bytes through brotli compress asynchronously', async () => {
      await compressor.compressAsync('hello');
      expect(mockBrotli.compress).toHaveBeenCalledOnce();
      const callArg = mockBrotli.compress.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(Uint8Array);
    });

    it('should work without calling init first', async () => {
      // compressAsync fetches brotliPromise directly, no init() required
      const input = 'no init needed';
      const compressed = await compressor.compressAsync(input);
      const decompressed = await compressor.decompressAsync(compressed);
      expect(decompressed).toBe(input);
    });
  });

  describe('Compressor singleton', () => {
    it('should export a pre-created StrCompressor instance', () => {
      expect(Compressor).toBeInstanceOf(StrCompressor);
    });

    it('should be the same object across imports', async () => {
      const { Compressor: C2 } = await import('./compass');
      expect(Compressor).toBe(C2);
    });
  });
});
