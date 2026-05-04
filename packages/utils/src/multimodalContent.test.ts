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
        { type: 'text' as const, text: 'Look at this:' },
        { type: 'image' as const, image: 'data:image/jpeg;base64,xyz' },
        { type: 'text' as const, text: 'What do you think?' },
      ];
      const result = serializePartsForStorage(parts);
      expect(result).toBe(JSON.stringify(parts));
    });

    it('should serialize empty array to empty JSON array', () => {
      const result = serializePartsForStorage([]);
      expect(result).toBe('[]');
    });

    it('should serialize parts with thoughtSignature', () => {
      const parts = [{ type: 'text' as const, text: 'Reasoning', thoughtSignature: 'sig-abc' }];
      const result = serializePartsForStorage(parts);
      expect(JSON.parse(result)).toEqual(parts);
    });

    it('should produce valid JSON that can be re-parsed', () => {
      const parts = [{ type: 'text' as const, text: 'Test' }];
      const result = serializePartsForStorage(parts);
      expect(() => JSON.parse(result)).not.toThrow();
    });
  });

  describe('deserializeParts', () => {
    it('should deserialize valid text parts JSON string', () => {
      const parts = [{ type: 'text', text: 'Hello' }];
      const result = deserializeParts(JSON.stringify(parts));
      expect(result).toEqual(parts);
    });

    it('should deserialize valid image parts JSON string', () => {
      const parts = [{ type: 'image', image: 'data:image/png;base64,abc' }];
      const result = deserializeParts(JSON.stringify(parts));
      expect(result).toEqual(parts);
    });

    it('should deserialize mixed parts JSON string', () => {
      const parts = [
        { type: 'text', text: 'Caption:' },
        { type: 'image', image: 'data:image/png;base64,xyz' },
      ];
      const result = deserializeParts(JSON.stringify(parts));
      expect(result).toEqual(parts);
    });

    it('should return null for plain text string', () => {
      const result = deserializeParts('Hello world');
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
      const result = deserializeParts(JSON.stringify({ type: 'text', text: 'hello' }));
      expect(result).toBeNull();
    });

    it('should return null for empty JSON array', () => {
      const result = deserializeParts('[]');
      expect(result).toBeNull();
    });

    it('should return null for JSON array with elements missing type field', () => {
      const result = deserializeParts(JSON.stringify([{ text: 'no type field' }]));
      expect(result).toBeNull();
    });

    it('should return null for JSON number', () => {
      const result = deserializeParts('42');
      expect(result).toBeNull();
    });

    it('should return null for JSON null', () => {
      const result = deserializeParts('null');
      expect(result).toBeNull();
    });

    it('should return null for JSON string value', () => {
      const result = deserializeParts('"just a string"');
      expect(result).toBeNull();
    });
  });

  describe('round-trip serialization', () => {
    it('should serialize and deserialize text parts correctly', () => {
      const original = [{ type: 'text' as const, text: 'Round-trip test' }];
      const serialized = serializePartsForStorage(original);
      const deserialized = deserializeParts(serialized);
      expect(deserialized).toEqual(original);
    });

    it('should serialize and deserialize image parts correctly', () => {
      const original = [{ type: 'image' as const, image: 'data:image/png;base64,abc' }];
      const serialized = serializePartsForStorage(original);
      const deserialized = deserializeParts(serialized);
      expect(deserialized).toEqual(original);
    });

    it('should serialize and deserialize complex multimodal content', () => {
      const original = [
        { type: 'text' as const, text: 'Look at this image:' },
        { type: 'image' as const, image: 'data:image/jpeg;base64,base64data' },
        { type: 'text' as const, text: 'And this one:' },
        { type: 'image' as const, image: 'data:image/png;base64,moredata' },
      ];
      const serialized = serializePartsForStorage(original);
      const deserialized = deserializeParts(serialized);
      expect(deserialized).toEqual(original);
    });

    it('should preserve thoughtSignature through round-trip', () => {
      const original = [
        { type: 'text' as const, text: 'Thinking...', thoughtSignature: 'sig-xyz' },
      ];
      const serialized = serializePartsForStorage(original);
      const deserialized = deserializeParts(serialized);
      expect(deserialized).toEqual(original);
    });
  });
});
