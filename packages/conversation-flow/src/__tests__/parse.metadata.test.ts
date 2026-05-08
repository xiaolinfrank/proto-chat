import { describe, expect, it } from 'vitest';

import { parse } from '../parse';
import type { Message } from '../types';

/**
 * Tests for the metadata cleaning logic in parse().
 *
 * For assistant messages with non-empty tools and metadata, parse() strips all
 * metadata except the known usage/performance fields. Other message types keep
 * their metadata unchanged.
 */

const USAGE_PERFORMANCE_FIELDS = [
  'acceptedPredictionTokens',
  'cost',
  'duration',
  'inputAudioTokens',
  'inputCacheMissTokens',
  'inputCachedTokens',
  'inputCitationTokens',
  'inputImageTokens',
  'inputTextTokens',
  'inputWriteCacheTokens',
  'latency',
  'outputAudioTokens',
  'outputImageTokens',
  'outputReasoningTokens',
  'outputTextTokens',
  'rejectedPredictionTokens',
  'totalInputTokens',
  'totalOutputTokens',
  'totalTokens',
  'tps',
  'ttft',
] as const;

const TOOL_CALL = {
  apiName: 'search',
  arguments: '{}',
  id: 'tool-1',
  identifier: 'search',
};

function makeMessage(overrides: Partial<Message> & Pick<Message, 'id' | 'role'>): Message {
  return {
    content: 'hello',
    createdAt: 1000,
    meta: {},
    updatedAt: 1000,
    ...overrides,
  };
}

describe('parse - messageMap metadata cleaning', () => {
  describe('assistant messages with tools', () => {
    it('should strip non-performance metadata fields', () => {
      const messages: Message[] = [
        makeMessage({
          id: 'msg-1',
          metadata: {
            cost: 0.01,
            debugInfo: 'should-be-removed',
            totalTokens: 100,
          },
          role: 'assistant',
          tools: [TOOL_CALL],
        }),
      ];

      const result = parse(messages);

      expect(result.messageMap['msg-1'].metadata).toEqual({
        cost: 0.01,
        totalTokens: 100,
      });
    });

    it('should preserve all usage/performance fields', () => {
      const fullMetadata: Record<string, number> = {};
      for (const field of USAGE_PERFORMANCE_FIELDS) {
        fullMetadata[field] = 42;
      }

      const messages: Message[] = [
        makeMessage({
          id: 'msg-1',
          metadata: { ...fullMetadata, customField: 'drop-me' },
          role: 'assistant',
          tools: [TOOL_CALL],
        }),
      ];

      const result = parse(messages);
      const cleaned = result.messageMap['msg-1'].metadata as Record<string, any>;

      for (const field of USAGE_PERFORMANCE_FIELDS) {
        expect(cleaned[field]).toBe(42);
      }
      expect(cleaned['customField']).toBeUndefined();
    });

    it('should set metadata to undefined when no performance fields remain after cleaning', () => {
      const messages: Message[] = [
        makeMessage({
          id: 'msg-1',
          metadata: { customField: 'only-custom', anotherField: true },
          role: 'assistant',
          tools: [TOOL_CALL],
        }),
      ];

      const result = parse(messages);

      expect(result.messageMap['msg-1'].metadata).toBeUndefined();
    });

    it('should not mutate the original message metadata', () => {
      const originalMetadata = { cost: 0.05, customField: 'value' };
      const messages: Message[] = [
        makeMessage({
          id: 'msg-1',
          metadata: originalMetadata,
          role: 'assistant',
          tools: [TOOL_CALL],
        }),
      ];

      parse(messages);

      expect(originalMetadata).toHaveProperty('customField', 'value');
    });
  });

  describe('assistant messages without tools', () => {
    it('should keep all metadata when tools array is absent', () => {
      const messages: Message[] = [
        makeMessage({
          id: 'msg-1',
          metadata: { cost: 0.01, customField: 'keep-me' },
          role: 'assistant',
        }),
      ];

      const result = parse(messages);

      expect(result.messageMap['msg-1'].metadata).toEqual({
        cost: 0.01,
        customField: 'keep-me',
      });
    });

    it('should keep all metadata when tools array is empty', () => {
      const messages: Message[] = [
        makeMessage({
          id: 'msg-1',
          metadata: { cost: 0.01, customField: 'keep-me' },
          role: 'assistant',
          tools: [],
        }),
      ];

      const result = parse(messages);

      expect(result.messageMap['msg-1'].metadata).toEqual({
        cost: 0.01,
        customField: 'keep-me',
      });
    });

    it('should keep null metadata unchanged (null is falsy, skips cleaning)', () => {
      const messages: Message[] = [
        makeMessage({
          id: 'msg-1',
          metadata: null,
          role: 'assistant',
          tools: [TOOL_CALL],
        }),
      ];

      expect(() => parse(messages)).not.toThrow();
      const result = parse(messages);
      expect(result.messageMap['msg-1'].metadata).toBeNull();
    });
  });

  describe('non-assistant message roles', () => {
    it('should keep all metadata for user messages', () => {
      const messages: Message[] = [
        makeMessage({
          id: 'msg-1',
          metadata: { customField: 'keep-me', cost: 0.01 },
          role: 'user',
        }),
      ];

      const result = parse(messages);

      expect(result.messageMap['msg-1'].metadata).toEqual({
        cost: 0.01,
        customField: 'keep-me',
      });
    });

    it('should keep all metadata for system messages', () => {
      const messages: Message[] = [
        makeMessage({
          id: 'msg-1',
          metadata: { systemField: 'keep-me' },
          role: 'system',
        }),
      ];

      const result = parse(messages);

      expect(result.messageMap['msg-1'].metadata).toEqual({ systemField: 'keep-me' });
    });
  });

  describe('messageMap completeness', () => {
    it('should include all messages in messageMap', () => {
      const messages: Message[] = [
        makeMessage({ id: 'msg-1', role: 'user' }),
        makeMessage({ id: 'msg-2', parentId: 'msg-1', role: 'assistant', tools: [TOOL_CALL] }),
        makeMessage({ id: 'msg-3', parentId: 'msg-2', role: 'user' }),
      ];

      const result = parse(messages);

      expect(Object.keys(result.messageMap)).toHaveLength(3);
      expect(result.messageMap['msg-1']).toBeDefined();
      expect(result.messageMap['msg-2']).toBeDefined();
      expect(result.messageMap['msg-3']).toBeDefined();
    });

    it('should return plain object (not Map) for messageMap', () => {
      const messages: Message[] = [makeMessage({ id: 'msg-1', role: 'user' })];

      const result = parse(messages);

      expect(result.messageMap).not.toBeInstanceOf(Map);
      expect(typeof result.messageMap).toBe('object');
    });

    it('should handle empty messages array', () => {
      const result = parse([]);

      expect(result.messageMap).toEqual({});
      expect(result.flatList).toEqual([]);
      expect(result.contextTree).toEqual([]);
    });
  });
});
