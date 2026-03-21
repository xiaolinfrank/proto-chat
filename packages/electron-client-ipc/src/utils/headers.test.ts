import { describe, expect, it } from 'vitest';

import { headersToRecord } from './headers';

describe('headersToRecord', () => {
  it('should return empty record when no headers provided', () => {
    const result = headersToRecord();
    expect(result).toEqual({});
  });

  it('should return empty record when undefined is provided', () => {
    const result = headersToRecord(undefined);
    expect(result).toEqual({});
  });

  it('should convert Headers instance to record', () => {
    const headers = new Headers();
    headers.set('content-type', 'application/json');
    headers.set('authorization', 'Bearer token123');

    const result = headersToRecord(headers);
    expect(result).toEqual({
      'content-type': 'application/json',
      authorization: 'Bearer token123',
    });
  });

  it('should strip host, connection, and content-length from Headers instance', () => {
    const headers = new Headers();
    headers.set('content-type', 'application/json');
    headers.set('host', 'example.com');
    headers.set('connection', 'keep-alive');
    headers.set('content-length', '42');

    const result = headersToRecord(headers);
    expect(result).toEqual({ 'content-type': 'application/json' });
    expect(result).not.toHaveProperty('host');
    expect(result).not.toHaveProperty('connection');
    expect(result).not.toHaveProperty('content-length');
  });

  it('should convert array of header tuples to record', () => {
    const headers: [string, string][] = [
      ['content-type', 'text/plain'],
      ['x-custom', 'value'],
    ];

    const result = headersToRecord(headers);
    expect(result).toEqual({
      'content-type': 'text/plain',
      'x-custom': 'value',
    });
  });

  it('should strip host, connection, and content-length from array headers', () => {
    const headers: [string, string][] = [
      ['content-type', 'text/html'],
      ['host', 'localhost'],
      ['connection', 'close'],
      ['content-length', '100'],
    ];

    const result = headersToRecord(headers);
    expect(result).toEqual({ 'content-type': 'text/html' });
    expect(result).not.toHaveProperty('host');
    expect(result).not.toHaveProperty('connection');
    expect(result).not.toHaveProperty('content-length');
  });

  it('should convert plain object headers to record', () => {
    const headers = {
      'content-type': 'application/json',
      'x-api-key': 'secret',
    };

    const result = headersToRecord(headers);
    expect(result).toEqual({
      'content-type': 'application/json',
      'x-api-key': 'secret',
    });
  });

  it('should strip host, connection, and content-length from plain object headers', () => {
    const headers = {
      authorization: 'Bearer abc',
      'content-length': '256',
      connection: 'keep-alive',
      host: 'api.example.com',
    };

    const result = headersToRecord(headers);
    expect(result).toEqual({ authorization: 'Bearer abc' });
  });

  it('should handle empty Headers instance', () => {
    const headers = new Headers();
    const result = headersToRecord(headers);
    expect(result).toEqual({});
  });

  it('should handle empty array of headers', () => {
    const result = headersToRecord([]);
    expect(result).toEqual({});
  });

  it('should handle empty plain object', () => {
    const result = headersToRecord({});
    expect(result).toEqual({});
  });

  it('should handle multiple values for the same key by overwriting', () => {
    const headers: [string, string][] = [
      ['x-custom', 'first'],
      ['x-custom', 'second'],
    ];
    const result = headersToRecord(headers);
    expect(result['x-custom']).toBe('second');
  });
});
