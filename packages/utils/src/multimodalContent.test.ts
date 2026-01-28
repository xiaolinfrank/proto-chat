import { MessageContentPart } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { deserializeParts, serializePartsForStorage } from './multimodalContent';

describe('multimodalContent', () => {
  describe('serializePartsForStorage', () => {
    it('should serialize a single text part to JSON string', () => {
      const parts: MessageContentPart[] = [{ type: 'text' as const, text: 'Hello, world!' }];
      const result = serializePartsForStorage(parts);
      expect(result).toBe('[{"type":"text","text":"Hello, world!"}]');
    });

    it('should serialize multiple parts to JSON string', () => {
      const parts: MessageContentPart[] = [
        { type: 'text' as const, text: 'Check this image:' },
        { type: 'image' as const, image: 'https://example.com/image.jpg' },
      ];
      const result = serializePartsForStorage(parts);
      expect(JSON.parse(result)).toEqual(parts);
    });

    it('should serialize empty array', () => {
      const parts: MessageContentPart[] = [];
      const result = serializePartsForStorage(parts);
      expect(result).toBe('[]');
    });

    it('should handle parts with special characters', () => {
      const parts: MessageContentPart[] = [
        { type: 'text' as const, text: 'Hello "world" with \n newline and \t tab' },
      ];
      const result = serializePartsForStorage(parts);
      const parsed = JSON.parse(result);
      expect(parsed[0].text).toBe('Hello "world" with \n newline and \t tab');
    });

    it('should serialize image parts', () => {
      const parts: MessageContentPart[] = [
        {
          type: 'image' as const,
          image: 'https://example.com/image.jpg',
        },
      ];
      const result = serializePartsForStorage(parts);
      expect(JSON.parse(result)).toEqual(parts);
    });
  });

  describe('deserializeParts', () => {
    it('should deserialize valid JSON array of parts', () => {
      const content = '[{"type":"text","text":"Hello"}]';
      const result = deserializeParts(content);
      expect(result).toEqual([{ type: 'text', text: 'Hello' }]);
    });

    it('should deserialize multiple parts', () => {
      const parts = [
        { type: 'text', text: 'Check this:' },
        { type: 'image', image: 'https://example.com/img.jpg' },
      ];
      const content = JSON.stringify(parts);
      const result = deserializeParts(content);
      expect(result).toEqual(parts);
    });

    it('should return null for plain text (not JSON)', () => {
      const content = 'Just plain text';
      const result = deserializeParts(content);
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const content = '{invalid json}';
      const result = deserializeParts(content);
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const content = '';
      const result = deserializeParts(content);
      expect(result).toBeNull();
    });

    it('should return null for empty JSON array', () => {
      const content = '[]';
      const result = deserializeParts(content);
      expect(result).toBeNull();
    });

    it('should return null for JSON object (not array)', () => {
      const content = '{"type":"text","text":"Hello"}';
      const result = deserializeParts(content);
      expect(result).toBeNull();
    });

    it('should return null for JSON array without type field', () => {
      const content = '[{"text":"Hello"}]';
      const result = deserializeParts(content);
      expect(result).toBeNull();
    });

    it('should return null for JSON primitive values', () => {
      expect(deserializeParts('123')).toBeNull();
      expect(deserializeParts('"string"')).toBeNull();
      expect(deserializeParts('true')).toBeNull();
      expect(deserializeParts('null')).toBeNull();
    });

    it('should handle JSON with special characters', () => {
      const parts = [{ type: 'text', text: 'Hello "world" with \n newline' }];
      const content = JSON.stringify(parts);
      const result = deserializeParts(content);
      expect(result).toEqual(parts);
    });

    it('should validate that first element has type field', () => {
      const content = '[{"type":"text","text":"Hello"},{"text":"No type"}]';
      const result = deserializeParts(content);
      // Should succeed because first element has type
      expect(result).toEqual([
        { type: 'text', text: 'Hello' },
        { text: 'No type' },
      ]);
    });

    it('should handle image parts', () => {
      const parts = [
        {
          type: 'image',
          image: 'https://example.com/image.jpg',
        },
      ];
      const content = JSON.stringify(parts);
      const result = deserializeParts(content);
      expect(result).toEqual(parts);
    });

    it('should handle whitespace in JSON', () => {
      const content = '  [  { "type" : "text" , "text" : "Hello" }  ]  ';
      const result = deserializeParts(content);
      expect(result).toEqual([{ type: 'text', text: 'Hello' }]);
    });
  });

  describe('round-trip serialization', () => {
    it('should serialize and deserialize back to original data', () => {
      const originalParts: MessageContentPart[] = [
        { type: 'text' as const, text: 'Hello, world!' },
        { type: 'image' as const, image: 'https://example.com/image.jpg' },
      ];

      const serialized = serializePartsForStorage(originalParts);
      const deserialized = deserializeParts(serialized);

      expect(deserialized).toEqual(originalParts);
    });

    it('should handle empty array round-trip', () => {
      const originalParts: MessageContentPart[] = [];
      const serialized = serializePartsForStorage(originalParts);
      const deserialized = deserializeParts(serialized);

      // Empty array should return null in deserialization
      expect(deserialized).toBeNull();
    });

    it('should handle complex parts round-trip', () => {
      const originalParts: MessageContentPart[] = [
        {
          type: 'text' as const,
          text: 'Complex text with "quotes" and \n newlines',
        },
        {
          type: 'image' as const,
          image: 'https://example.com/image.jpg',
        },
      ];

      const serialized = serializePartsForStorage(originalParts);
      const deserialized = deserializeParts(serialized);

      expect(deserialized).toEqual(originalParts);
    });
  });
});
