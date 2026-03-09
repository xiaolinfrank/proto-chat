import { describe, expect, it } from 'vitest';

import { deserializeParts, serializePartsForStorage } from './multimodalContent';

describe('multimodalContent', () => {
  describe('serializePartsForStorage', () => {
    it('should serialize text parts to JSON string', () => {
      const parts = [{ type: 'text' as const, text: 'Hello world' }];
      const result = serializePartsForStorage(parts);
      expect(result).toBe(JSON.stringify(parts));
    });

    it('should serialize image parts to JSON string', () => {
      const parts = [{ type: 'image' as const, image: 'data:image/png;base64,abc123' }];
      const result = serializePartsForStorage(parts);
      expect(result).toBe(JSON.stringify(parts));
    });

    it('should serialize mixed text and image parts', () => {
      const parts = [
        { type: 'text' as const, text: 'Caption' },
        { type: 'image' as const, image: 'data:image/jpeg;base64,xyz' },
      ];
      const result = serializePartsForStorage(parts);
      expect(result).toBe(JSON.stringify(parts));
    });

    it('should serialize an empty array', () => {
      const result = serializePartsForStorage([]);
      expect(result).toBe('[]');
    });

    it('should serialize parts with optional thoughtSignature field', () => {
      const parts = [{ type: 'text' as const, text: 'Reasoning', thoughtSignature: 'sig123' }];
      const result = serializePartsForStorage(parts);
      expect(result).toBe(JSON.stringify(parts));
      expect(JSON.parse(result)[0].thoughtSignature).toBe('sig123');
    });
  });

  describe('deserializeParts', () => {
    it('should deserialize a valid JSON array of text parts', () => {
      const parts = [{ type: 'text', text: 'Hello' }];
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
        { type: 'text', text: 'Hello' },
        { type: 'image', image: 'data:image/jpeg;base64,xyz' },
      ];
      const input = JSON.stringify(parts);
      const result = deserializeParts(input);
      expect(result).toEqual(parts);
    });

    it('should return null for plain text (non-JSON)', () => {
      const result = deserializeParts('Hello, world!');
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const result = deserializeParts('{invalid json}');
      expect(result).toBeNull();
    });

    it('should return null for an empty string', () => {
      const result = deserializeParts('');
      expect(result).toBeNull();
    });

    it('should return null for a JSON object (not array)', () => {
      const result = deserializeParts(JSON.stringify({ type: 'text', text: 'hello' }));
      expect(result).toBeNull();
    });

    it('should return null for an empty JSON array', () => {
      // empty array fails length > 0 check
      const result = deserializeParts('[]');
      expect(result).toBeNull();
    });

    it('should return null for array items missing the type field', () => {
      const parts = [{ text: 'no type field' }];
      const result = deserializeParts(JSON.stringify(parts));
      expect(result).toBeNull();
    });

    it('should return null for a JSON number', () => {
      const result = deserializeParts('42');
      expect(result).toBeNull();
    });

    it('should return null for a JSON null', () => {
      const result = deserializeParts('null');
      expect(result).toBeNull();
    });

    it('should round-trip serialize then deserialize correctly', () => {
      const original = [
        { type: 'text' as const, text: 'First part' },
        { type: 'image' as const, image: 'data:image/png;base64,abc' },
      ];
      const serialized = serializePartsForStorage(original);
      const deserialized = deserializeParts(serialized);
      expect(deserialized).toEqual(original);
    });
  });
});
