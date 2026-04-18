import { describe, expect, it } from 'vitest';

import { deserializeParts, serializePartsForStorage } from './multimodalContent';

import type { MessageContentPart } from '@lobechat/types';

describe('multimodalContent', () => {
  describe('serializePartsForStorage', () => {
    it('should serialize an array of text parts to JSON', () => {
      const parts: MessageContentPart[] = [{ type: 'text', text: 'Hello world' }];
      expect(serializePartsForStorage(parts)).toBe(JSON.stringify(parts));
    });

    it('should serialize an array of image parts', () => {
      const parts: MessageContentPart[] = [{ type: 'image', image: 'data:image/png;base64,abc' }];
      expect(serializePartsForStorage(parts)).toBe(JSON.stringify(parts));
    });

    it('should serialize mixed text and image parts', () => {
      const parts: MessageContentPart[] = [
        { type: 'text', text: 'Hello' },
        { type: 'image', image: 'data:image/jpeg;base64,xyz' },
      ];
      expect(serializePartsForStorage(parts)).toBe(JSON.stringify(parts));
    });

    it('should serialize empty array to "[]"', () => {
      expect(serializePartsForStorage([])).toBe('[]');
    });
  });

  describe('deserializeParts', () => {
    it('should return parsed parts for valid JSON array with type field', () => {
      const parts: MessageContentPart[] = [{ type: 'text', text: 'Hello' }];
      const json = JSON.stringify(parts);
      expect(deserializeParts(json)).toEqual(parts);
    });

    it('should round-trip through serialize and deserialize', () => {
      const parts: MessageContentPart[] = [
        { type: 'text', text: 'First part' },
        { type: 'image', image: 'data:image/png;base64,abc' },
      ];
      expect(deserializeParts(serializePartsForStorage(parts))).toEqual(parts);
    });

    it('should return null for plain text string', () => {
      expect(deserializeParts('Hello World')).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      expect(deserializeParts('{invalid json}')).toBeNull();
    });

    it('should return null for JSON object (not an array)', () => {
      expect(deserializeParts('{"type":"text","text":"hello"}')).toBeNull();
    });

    it('should return null for empty JSON array', () => {
      expect(deserializeParts('[]')).toBeNull();
    });

    it('should return null for array without type field on first element', () => {
      expect(deserializeParts('[{"text":"hello"}]')).toBeNull();
    });

    it('should return null for JSON number', () => {
      expect(deserializeParts('42')).toBeNull();
    });

    it('should return null for JSON null', () => {
      expect(deserializeParts('null')).toBeNull();
    });

    it('should preserve thoughtSignature field when present', () => {
      const parts: MessageContentPart[] = [
        { type: 'text', text: 'Hello', thoughtSignature: 'sig-abc' },
      ];
      expect(deserializeParts(serializePartsForStorage(parts))).toEqual(parts);
    });
  });
});
