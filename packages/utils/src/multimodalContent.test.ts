import { describe, expect, it } from 'vitest';

import { deserializeParts, serializePartsForStorage } from './multimodalContent';

describe('multimodalContent', () => {
  describe('serializePartsForStorage', () => {
    it('should serialize text parts to JSON string', () => {
      const parts = [{ type: 'text' as const, text: 'Hello, world!' }];
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
        { type: 'text' as const, text: 'Look at this:' },
        { type: 'image' as const, image: 'data:image/jpeg;base64,xyz' },
        { type: 'text' as const, text: 'What do you think?' },
      ];
      const result = serializePartsForStorage(parts);
      expect(result).toBe(JSON.stringify(parts));
    });

    it('should serialize parts with optional thoughtSignature', () => {
      const parts = [{ type: 'text' as const, text: 'With signature', thoughtSignature: 'sig123' }];
      const result = serializePartsForStorage(parts);
      expect(result).toBe(JSON.stringify(parts));
    });

    it('should serialize an empty array', () => {
      const result = serializePartsForStorage([]);
      expect(result).toBe('[]');
    });

    it('should return a valid JSON string', () => {
      const parts = [{ type: 'text' as const, text: 'test' }];
      const result = serializePartsForStorage(parts);
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  describe('deserializeParts', () => {
    it('should deserialize a valid text parts JSON string', () => {
      const parts = [{ type: 'text' as const, text: 'Hello' }];
      const json = JSON.stringify(parts);
      const result = deserializeParts(json);
      expect(result).toEqual(parts);
    });

    it('should deserialize a valid image parts JSON string', () => {
      const parts = [{ type: 'image' as const, image: 'data:image/png;base64,abc' }];
      const json = JSON.stringify(parts);
      const result = deserializeParts(json);
      expect(result).toEqual(parts);
    });

    it('should deserialize mixed content parts', () => {
      const parts = [
        { type: 'text' as const, text: 'Description' },
        { type: 'image' as const, image: 'data:image/gif;base64,xyz' },
      ];
      const json = JSON.stringify(parts);
      const result = deserializeParts(json);
      expect(result).toEqual(parts);
    });

    it('should return null for plain text (non-JSON)', () => {
      const result = deserializeParts('just plain text');
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = deserializeParts('');
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const result = deserializeParts('{invalid json}');
      expect(result).toBeNull();
    });

    it('should return null for JSON object (not array)', () => {
      const result = deserializeParts('{"type": "text", "text": "hello"}');
      expect(result).toBeNull();
    });

    it('should return null for empty JSON array', () => {
      const result = deserializeParts('[]');
      expect(result).toBeNull();
    });

    it('should return null for array without type property', () => {
      const result = deserializeParts('[{"text": "hello"}]');
      expect(result).toBeNull();
    });

    it('should return null for JSON array of primitives', () => {
      const result = deserializeParts('[1, 2, 3]');
      expect(result).toBeNull();
    });

    it('should return null for JSON array of strings', () => {
      const result = deserializeParts('["hello", "world"]');
      expect(result).toBeNull();
    });

    it('should be a roundtrip inverse of serializePartsForStorage', () => {
      const original = [
        { type: 'text' as const, text: 'Hello' },
        { type: 'image' as const, image: 'data:image/png;base64,test' },
      ];
      const serialized = serializePartsForStorage(original);
      const deserialized = deserializeParts(serialized);
      expect(deserialized).toEqual(original);
    });

    it('should handle parts with special characters in text', () => {
      const parts = [{ type: 'text' as const, text: 'Line1\nLine2\t"quoted"' }];
      const json = serializePartsForStorage(parts);
      const result = deserializeParts(json);
      expect(result).toEqual(parts);
    });

    it('should handle parts with thoughtSignature field', () => {
      const parts = [{ type: 'text' as const, text: 'Signed', thoughtSignature: 'sig456' }];
      const json = serializePartsForStorage(parts);
      const result = deserializeParts(json);
      expect(result).toEqual(parts);
    });
  });
});
