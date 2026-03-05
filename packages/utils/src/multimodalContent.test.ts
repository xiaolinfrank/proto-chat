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

    it('should serialize mixed parts to JSON string', () => {
      const parts = [
        { type: 'text' as const, text: 'Look at this:' },
        { type: 'image' as const, image: 'data:image/jpeg;base64,xyz' },
      ];
      const result = serializePartsForStorage(parts);
      expect(result).toBe(JSON.stringify(parts));
    });

    it('should serialize empty array to empty JSON array string', () => {
      const result = serializePartsForStorage([]);
      expect(result).toBe('[]');
    });

    it('should preserve thoughtSignature field', () => {
      const parts = [
        { type: 'text' as const, text: 'Hello', thoughtSignature: 'sig123' },
      ];
      const result = serializePartsForStorage(parts);
      const parsed = JSON.parse(result);
      expect(parsed[0].thoughtSignature).toBe('sig123');
    });
  });

  describe('deserializeParts', () => {
    it('should deserialize valid text parts JSON', () => {
      const parts = [{ type: 'text', text: 'Hello world' }];
      const json = JSON.stringify(parts);
      const result = deserializeParts(json);
      expect(result).toEqual(parts);
    });

    it('should deserialize valid image parts JSON', () => {
      const parts = [{ type: 'image', image: 'data:image/png;base64,abc' }];
      const json = JSON.stringify(parts);
      const result = deserializeParts(json);
      expect(result).toEqual(parts);
    });

    it('should deserialize mixed parts JSON', () => {
      const parts = [
        { type: 'text', text: 'Look at this:' },
        { type: 'image', image: 'data:image/jpeg;base64,xyz' },
      ];
      const json = JSON.stringify(parts);
      const result = deserializeParts(json);
      expect(result).toEqual(parts);
    });

    it('should return null for plain text string', () => {
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

    it('should return null for JSON object (not array)', () => {
      const result = deserializeParts(JSON.stringify({ type: 'text', text: 'hello' }));
      expect(result).toBeNull();
    });

    it('should return null for empty JSON array', () => {
      const result = deserializeParts('[]');
      expect(result).toBeNull();
    });

    it('should return null for JSON array without type field', () => {
      const result = deserializeParts(JSON.stringify([{ text: 'hello' }]));
      expect(result).toBeNull();
    });

    it('should return null for JSON array with null first element', () => {
      const result = deserializeParts(JSON.stringify([null]));
      expect(result).toBeNull();
    });

    it('should round-trip serialize then deserialize correctly', () => {
      const original = [
        { type: 'text' as const, text: 'Hello world' },
        { type: 'image' as const, image: 'data:image/png;base64,abc' },
      ];
      const serialized = serializePartsForStorage(original);
      const deserialized = deserializeParts(serialized);
      expect(deserialized).toEqual(original);
    });

    it('should return null for JSON number', () => {
      const result = deserializeParts('42');
      expect(result).toBeNull();
    });

    it('should return null for JSON boolean', () => {
      const result = deserializeParts('true');
      expect(result).toBeNull();
    });
  });
});
