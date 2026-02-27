import { describe, expect, it } from 'vitest';

import { deserializeParts, serializePartsForStorage } from './multimodalContent';

describe('serializePartsForStorage', () => {
  it('should serialize an array of text parts to JSON string', () => {
    const parts = [{ type: 'text' as const, text: 'Hello world' }];
    const result = serializePartsForStorage(parts);
    expect(result).toBe(JSON.stringify(parts));
  });

  it('should serialize an array of image parts', () => {
    const parts = [{ type: 'image' as const, image: 'data:image/png;base64,abc123' }];
    const result = serializePartsForStorage(parts);
    expect(result).toBe(JSON.stringify(parts));
  });

  it('should serialize mixed text and image parts', () => {
    const parts = [
      { type: 'text' as const, text: 'Describe this image:' },
      { type: 'image' as const, image: 'data:image/jpeg;base64,xyz' },
    ];
    const result = serializePartsForStorage(parts);
    expect(result).toBe(JSON.stringify(parts));
  });

  it('should serialize an empty array', () => {
    const result = serializePartsForStorage([]);
    expect(result).toBe('[]');
  });

  it('should serialize parts with thoughtSignature', () => {
    const parts = [{ type: 'text' as const, text: 'content', thoughtSignature: 'sig123' }];
    const result = serializePartsForStorage(parts);
    expect(result).toBe(JSON.stringify(parts));
    expect(JSON.parse(result)[0].thoughtSignature).toBe('sig123');
  });

  it('should return a valid JSON string', () => {
    const parts = [{ type: 'text' as const, text: 'test' }];
    const result = serializePartsForStorage(parts);
    expect(() => JSON.parse(result)).not.toThrow();
  });
});

describe('deserializeParts', () => {
  it('should deserialize a valid JSON array of text parts', () => {
    const parts = [{ type: 'text', text: 'Hello world' }];
    const input = JSON.stringify(parts);
    const result = deserializeParts(input);
    expect(result).toEqual(parts);
  });

  it('should deserialize a valid JSON array of image parts', () => {
    const parts = [{ type: 'image', image: 'data:image/png;base64,abc' }];
    const input = JSON.stringify(parts);
    const result = deserializeParts(input);
    expect(result).toEqual(parts);
  });

  it('should deserialize mixed text and image parts', () => {
    const parts = [
      { type: 'text', text: 'Look at this:' },
      { type: 'image', image: 'data:image/jpeg;base64,xyz' },
    ];
    const input = JSON.stringify(parts);
    const result = deserializeParts(input);
    expect(result).toEqual(parts);
  });

  it('should return null for plain text string', () => {
    const result = deserializeParts('Hello, plain text');
    expect(result).toBeNull();
  });

  it('should return null for invalid JSON', () => {
    const result = deserializeParts('{not valid json}');
    expect(result).toBeNull();
  });

  it('should return null for empty string', () => {
    const result = deserializeParts('');
    expect(result).toBeNull();
  });

  it('should return null for a JSON object (not an array)', () => {
    const result = deserializeParts(JSON.stringify({ type: 'text', text: 'hello' }));
    expect(result).toBeNull();
  });

  it('should return null for an empty JSON array', () => {
    const result = deserializeParts('[]');
    expect(result).toBeNull();
  });

  it('should return null for a JSON array of primitives (no type property)', () => {
    const result = deserializeParts(JSON.stringify([1, 2, 3]));
    expect(result).toBeNull();
  });

  it('should return null for a JSON array where first element has no type', () => {
    const result = deserializeParts(JSON.stringify([{ text: 'no type field' }]));
    expect(result).toBeNull();
  });

  it('should return null for a JSON number', () => {
    const result = deserializeParts('42');
    expect(result).toBeNull();
  });

  it('should return null for a JSON boolean', () => {
    const result = deserializeParts('true');
    expect(result).toBeNull();
  });

  it('should correctly round-trip with serializePartsForStorage', () => {
    const original = [
      { type: 'text' as const, text: 'First part' },
      { type: 'image' as const, image: 'data:image/png;base64,test' },
    ];
    const serialized = serializePartsForStorage(original);
    const deserialized = deserializeParts(serialized);
    expect(deserialized).toEqual(original);
  });

  it('should handle parts with thoughtSignature on round-trip', () => {
    const original = [{ type: 'text' as const, text: 'content', thoughtSignature: 'sig' }];
    const serialized = serializePartsForStorage(original);
    const deserialized = deserializeParts(serialized);
    expect(deserialized).toEqual(original);
  });
});
