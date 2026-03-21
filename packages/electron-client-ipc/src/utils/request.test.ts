import { describe, expect, it, vi } from 'vitest';

import { getRequestBody } from './request';

describe('getRequestBody', () => {
  it('should return undefined when body is undefined', async () => {
    const result = await getRequestBody(undefined);
    expect(result).toBeUndefined();
  });

  it('should return undefined when body is null', async () => {
    const result = await getRequestBody(null);
    expect(result).toBeUndefined();
  });

  it('should return string body as-is', async () => {
    const result = await getRequestBody('{"key":"value"}');
    expect(result).toBe('{"key":"value"}');
  });

  it('should return empty string as-is', async () => {
    const result = await getRequestBody('');
    expect(result).toBeUndefined();
  });

  it('should return ArrayBuffer as-is', async () => {
    const buffer = new ArrayBuffer(8);
    const result = await getRequestBody(buffer);
    expect(result).toBe(buffer);
  });

  it('should convert Uint8Array (ArrayBufferView) to ArrayBuffer slice', async () => {
    const buffer = new ArrayBuffer(16);
    const view = new Uint8Array(buffer, 4, 8);
    const result = await getRequestBody(view);

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect((result as ArrayBuffer).byteLength).toBe(8);
  });

  it('should convert Int32Array (ArrayBufferView) to ArrayBuffer slice', async () => {
    const buffer = new ArrayBuffer(16);
    const view = new Int32Array(buffer, 0, 2);
    const result = await getRequestBody(view);

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect((result as ArrayBuffer).byteLength).toBe(8); // 2 int32 = 8 bytes
  });

  it('should convert Blob to ArrayBuffer', async () => {
    const content = 'hello world';
    const blob = new Blob([content], { type: 'text/plain' });

    const result = await getRequestBody(blob);

    expect(result).toBeInstanceOf(ArrayBuffer);
    const decoded = new TextDecoder().decode(result as ArrayBuffer);
    expect(decoded).toBe(content);
  });

  it('should throw error for unsupported body type (URLSearchParams)', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const params = new URLSearchParams({ key: 'value' });

    await expect(getRequestBody(params as any)).rejects.toThrow('不支持的 IPC 代理请求体类型');
    expect(consoleSpy).toHaveBeenCalledWith('不支持的 IPC 代理请求体类型:', 'object');

    consoleSpy.mockRestore();
  });

  it('should throw error for ReadableStream body', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stream = new ReadableStream();

    await expect(getRequestBody(stream as any)).rejects.toThrow('不支持的 IPC 代理请求体类型');

    consoleSpy.mockRestore();
  });

  it('should handle DataView (ArrayBufferView) correctly', async () => {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setInt32(0, 12345678);
    const view = new DataView(buffer, 0, 4);

    const result = await getRequestBody(view);
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect((result as ArrayBuffer).byteLength).toBe(4);
  });
});
