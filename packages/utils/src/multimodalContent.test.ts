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
        { type: 'text' as const, text: 'Description' },
      ];
      const result = serializePartsForStorage(parts);
      expect(result).toBe(JSON.stringify(parts));
      expect(JSON.parse(result)).toHaveLength(3);
    });

    it('should serialize empty array to empty JSON array string', () => {
      const result = serializePartsForStorage([]);
      expect(result).toBe('[]');
    });

    it('should serialize parts with optional thoughtSignature field', () => {
      const parts = [{ type: 'text' as const, text: 'Reasoning', thoughtSignature: 'sig123' }];
      const result = serializePartsForStorage(parts);
      const parsed = JSON.parse(result);
      expect(parsed[0].thoughtSignature).toBe('sig123');
    });

    it('should produce a valid JSON string that round-trips', () => {
      const parts = [
        { type: 'text' as const, text: 'Round trip test' },
        { type: 'image' as const, image: 'data:image/gif;base64,R0lGO' },
      ];
      const serialized = serializePartsForStorage(parts);
      const deserialized = JSON.parse(serialized);
      expect(deserialized).toEqual(parts);
    });
  });

  describe('deserializeParts', () => {
    it('should return text parts from valid JSON array', () => {
      const parts = [{ type: 'text', text: 'Hello' }];
      const result = deserializeParts(JSON.stringify(parts));
      expect(result).toEqual(parts);
    });

    it('should return image parts from valid JSON array', () => {
      const parts = [{ type: 'image', image: 'data:image/png;base64,abc' }];
      const result = deserializeParts(JSON.stringify(parts));
      expect(result).toEqual(parts);
    });

    it('should return mixed parts from valid JSON array', () => {
      const parts = [
        { type: 'text', text: 'Hello' },
        { type: 'image', image: 'data:image/png;base64,abc' },
      ];
      const result = deserializeParts(JSON.stringify(parts));
      expect(result).toHaveLength(2);
      expect(result).toEqual(parts);
    });

    it('should return null for plain text string (not JSON)', () => {
      const result = deserializeParts('Hello world');
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
      const result = deserializeParts(JSON.stringify({ type: 'text', text: 'Hello' }));
      expect(result).toBeNull();
    });

    it('should return null for empty JSON array', () => {
      const result = deserializeParts('[]');
      expect(result).toBeNull();
    });

    it('should return null for array of items without type field', () => {
      const result = deserializeParts(JSON.stringify([{ text: 'no type' }]));
      expect(result).toBeNull();
    });

    it('should return null for JSON number', () => {
      const result = deserializeParts('42');
      expect(result).toBeNull();
    });

    it('should return null for JSON boolean', () => {
      const result = deserializeParts('true');
      expect(result).toBeNull();
    });

    it('should return null for JSON null', () => {
      const result = deserializeParts('null');
      expect(result).toBeNull();
    });

    it('should preserve parts with thoughtSignature field', () => {
      const parts = [{ type: 'text', text: 'Reasoning', thoughtSignature: 'sig123' }];
      const result = deserializeParts(JSON.stringify(parts));
      expect(result).toEqual(parts);
    });
  });
});
