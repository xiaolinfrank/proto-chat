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
      const parts = [{ type: 'image' as const, image: 'base64encodeddata' }];
      const result = serializePartsForStorage(parts);
      expect(result).toBe(JSON.stringify(parts));
    });

    it('should serialize mixed text and image parts', () => {
      const parts = [
        { type: 'text' as const, text: 'Look at this:' },
        { type: 'image' as const, image: 'data:image/png;base64,abc123' },
      ];
      const result = serializePartsForStorage(parts);
      expect(result).toBe(JSON.stringify(parts));
      expect(typeof result).toBe('string');
    });

    it('should serialize an empty array', () => {
      const result = serializePartsForStorage([]);
      expect(result).toBe('[]');
    });

    it('should preserve thoughtSignature field', () => {
      const parts = [{ type: 'text' as const, text: 'Reasoning', thoughtSignature: 'sig123' }];
      const result = serializePartsForStorage(parts);
      const parsed = JSON.parse(result);
      expect(parsed[0].thoughtSignature).toBe('sig123');
    });
  });

  describe('deserializeParts', () => {
    it('should deserialize valid text parts JSON string', () => {
      const parts = [{ type: 'text', text: 'Hello' }];
      const result = deserializeParts(JSON.stringify(parts));
      expect(result).toEqual(parts);
    });

    it('should deserialize valid image parts JSON string', () => {
      const parts = [{ type: 'image', image: 'base64data' }];
      const result = deserializeParts(JSON.stringify(parts));
      expect(result).toEqual(parts);
    });

    it('should deserialize mixed parts', () => {
      const parts = [
        { type: 'text', text: 'Caption' },
        { type: 'image', image: 'data:image/jpeg;base64,xyz' },
      ];
      const result = deserializeParts(JSON.stringify(parts));
      expect(result).toEqual(parts);
    });

    it('should return null for invalid JSON string', () => {
      const result = deserializeParts('not valid json {[}');
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = deserializeParts('');
      expect(result).toBeNull();
    });

    it('should return null for a plain text string', () => {
      const result = deserializeParts('Hello world');
      expect(result).toBeNull();
    });

    it('should return null for JSON that is not an array', () => {
      const result = deserializeParts(JSON.stringify({ type: 'text', text: 'hi' }));
      expect(result).toBeNull();
    });

    it('should return null for an empty JSON array', () => {
      const result = deserializeParts('[]');
      expect(result).toBeNull();
    });

    it('should return null for array items without a type field', () => {
      const parts = [{ text: 'no type here' }];
      const result = deserializeParts(JSON.stringify(parts));
      expect(result).toBeNull();
    });

    it('should return null for JSON array of primitives', () => {
      const result = deserializeParts(JSON.stringify([1, 2, 3]));
      expect(result).toBeNull();
    });

    it('should round-trip serialize and deserialize correctly', () => {
      const original = [
        { type: 'text' as const, text: 'Hello' },
        { type: 'image' as const, image: 'data:image/png;base64,abc' },
      ];
      const serialized = serializePartsForStorage(original);
      const deserialized = deserializeParts(serialized);
      expect(deserialized).toEqual(original);
    });
  });
});
