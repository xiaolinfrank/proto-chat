import { describe, expect, it } from 'vitest';

import { deserializeParts, serializePartsForStorage } from './multimodalContent';

describe('multimodalContent', () => {
  describe('serializePartsForStorage', () => {
    it('should serialize an array of text parts to JSON string', () => {
      const parts = [{ type: 'text' as const, text: 'Hello world' }];
      const result = serializePartsForStorage(parts);
      expect(result).toBe(JSON.stringify(parts));
    });

    it('should serialize an array of image parts to JSON string', () => {
      const parts = [{ type: 'image' as const, image: 'data:image/png;base64,abc123' }];
      const result = serializePartsForStorage(parts);
      expect(result).toBe(JSON.stringify(parts));
    });

    it('should serialize mixed text and image parts', () => {
      const parts = [
        { type: 'text' as const, text: 'Describe this image:' },
        { type: 'image' as const, image: 'data:image/png;base64,abc123' },
      ];
      const result = serializePartsForStorage(parts);
      expect(result).toBe(JSON.stringify(parts));
    });

    it('should serialize an empty array', () => {
      const result = serializePartsForStorage([]);
      expect(result).toBe('[]');
    });

    it('should preserve all fields including optional thoughtSignature', () => {
      const parts = [{ type: 'text' as const, text: 'Hello', thoughtSignature: 'sig123' }];
      const result = serializePartsForStorage(parts);
      const parsed = JSON.parse(result);
      expect(parsed[0].thoughtSignature).toBe('sig123');
    });
  });

  describe('deserializeParts', () => {
    it('should deserialize a valid JSON array of text parts', () => {
      const parts = [{ type: 'text', text: 'Hello world' }];
      const result = deserializeParts(JSON.stringify(parts));
      expect(result).toEqual(parts);
    });

    it('should deserialize a valid JSON array of image parts', () => {
      const parts = [{ type: 'image', image: 'data:image/png;base64,abc123' }];
      const result = deserializeParts(JSON.stringify(parts));
      expect(result).toEqual(parts);
    });

    it('should deserialize mixed parts', () => {
      const parts = [
        { type: 'text', text: 'Hello' },
        { type: 'image', image: 'data:image/png;base64,abc' },
      ];
      const result = deserializeParts(JSON.stringify(parts));
      expect(result).toEqual(parts);
    });

    it('should return null for plain text (not JSON)', () => {
      const result = deserializeParts('Hello, this is plain text');
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const result = deserializeParts('{invalid json}');
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

    it('should return null for a JSON array without type field', () => {
      const result = deserializeParts(JSON.stringify([{ text: 'hello' }]));
      expect(result).toBeNull();
    });

    it('should return null for a JSON number', () => {
      const result = deserializeParts('42');
      expect(result).toBeNull();
    });

    it('should return null for a JSON string value', () => {
      const result = deserializeParts('"just a string"');
      expect(result).toBeNull();
    });

    it('should handle round-trip serialization and deserialization', () => {
      const parts = [
        { type: 'text' as const, text: 'Hello world' },
        { type: 'image' as const, image: 'data:image/jpeg;base64,xyz' },
      ];
      const serialized = serializePartsForStorage(parts);
      const deserialized = deserializeParts(serialized);
      expect(deserialized).toEqual(parts);
    });
  });
});
