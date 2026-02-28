import { describe, expect, it } from 'vitest';

import { merge, mergeArrayById } from './merge';

describe('merge', () => {
  describe('basic object merging', () => {
    it('should merge two simple objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };
      const result = merge(target, source);

      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should merge nested objects', () => {
      const target = { a: { x: 1, y: 2 }, b: 3 };
      const source = { a: { y: 4, z: 5 }, c: 6 };
      const result = merge(target, source);

      expect(result).toEqual({ a: { x: 1, y: 4, z: 5 }, b: 3, c: 6 });
    });

    it('should not mutate original objects', () => {
      const target = { a: 1 };
      const source = { b: 2 };
      const result = merge(target, source);

      expect(target).toEqual({ a: 1 });
      expect(source).toEqual({ b: 2 });
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });

  describe('array handling', () => {
    it('should replace arrays instead of merging them', () => {
      const target = { items: [1, 2, 3] };
      const source = { items: [4, 5] };
      const result = merge(target, source);

      expect(result).toEqual({ items: [4, 5] });
    });

    it('should handle arrays with objects', () => {
      const target = { items: [{ id: 1 }, { id: 2 }] };
      const source = { items: [{ id: 3 }] };
      const result = merge(target, source);

      expect(result).toEqual({ items: [{ id: 3 }] });
    });

    it('should replace array even when source is empty', () => {
      const target = { items: [1, 2, 3] };
      const source = { items: [] };
      const result = merge(target, source);

      expect(result).toEqual({ items: [] });
    });

    it('should handle nested arrays in objects', () => {
      const target = { a: { items: [1, 2] }, b: 3 };
      const source = { a: { items: [3, 4] } };
      const result = merge(target, source);

      expect(result).toEqual({ a: { items: [3, 4] }, b: 3 });
    });
  });

  describe('edge cases', () => {
    it('should handle empty target object', () => {
      const target = {};
      const source = { a: 1, b: 2 };
      const result = merge(target, source);

      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should handle empty source object', () => {
      const target = { a: 1, b: 2 };
      const source = {};
      const result = merge(target, source);

      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should handle both empty objects', () => {
      const target = {};
      const source = {};
      const result = merge(target, source);

      expect(result).toEqual({});
    });

    it('should handle null values', () => {
      const target = { a: 1, b: null };
      const source = { a: null, c: 3 };
      const result = merge(target, source);

      expect(result).toEqual({ a: null, b: null, c: 3 });
    });

    it('should not override existing values with undefined', () => {
      const target = { a: 1, b: undefined };
      const source = { a: undefined, c: 3 };
      const result = merge(target, source);

      // lodash merge does not override existing values with undefined
      expect(result).toEqual({ a: 1, b: undefined, c: 3 });
    });
  });

  describe('complex nested structures', () => {
    it('should merge deeply nested objects', () => {
      const target = { a: { b: { c: { d: 1 } } } };
      const source = { a: { b: { c: { e: 2 } } } };
      const result = merge(target, source);

      expect(result).toEqual({ a: { b: { c: { d: 1, e: 2 } } } });
    });

    it('should handle mixed nested structures with arrays and objects', () => {
      const target = {
        config: { items: [1, 2], options: { enabled: true } },
      };
      const source = {
        config: { items: [3, 4], options: { timeout: 1000 } },
      };
      const result = merge(target, source);

      expect(result).toEqual({
        config: { items: [3, 4], options: { enabled: true, timeout: 1000 } },
      });
    });
  });
});

describe('mergeArrayById', () => {
  type TestItem = {
    id: string;
    name?: string;
    value?: number;
    metadata?: Record<string, any>;
  };

  describe('basic merging', () => {
    it('should merge arrays based on id', () => {
      const defaultItems: TestItem[] = [
        { id: '1', name: 'default1', value: 10 },
        { id: '2', name: 'default2', value: 20 },
      ];
      const userItems: TestItem[] = [
        { id: '1', value: 100 },
        { id: '3', name: 'user3', value: 30 },
      ];

      const result = mergeArrayById(defaultItems, userItems);

      expect(result).toHaveLength(3);
      expect(result).toContainEqual({ id: '1', name: 'default1', value: 100 });
      expect(result).toContainEqual({ id: '2', name: 'default2', value: 20 });
      expect(result).toContainEqual({ id: '3', name: 'user3', value: 30 });
    });

    it('should preserve metadata from default items', () => {
      const defaultItems: TestItem[] = [
        { id: '1', name: 'default1', metadata: { key: 'value', created: '2024-01-01' } },
      ];
      const userItems: TestItem[] = [{ id: '1', value: 100 }];

      const result = mergeArrayById(defaultItems, userItems);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: '1',
        name: 'default1',
        value: 100,
        metadata: { key: 'value', created: '2024-01-01' },
      });
    });

    it('should override default values with user values', () => {
      const defaultItems: TestItem[] = [{ id: '1', name: 'default', value: 10 }];
      const userItems: TestItem[] = [{ id: '1', name: 'user', value: 20 }];

      const result = mergeArrayById(defaultItems, userItems);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: '1', name: 'user', value: 20 });
    });
  });

  describe('handling null and undefined values', () => {
    it('should ignore null values in user items', () => {
      const defaultItems: TestItem[] = [{ id: '1', name: 'default', value: 10 }];
      const userItems: TestItem[] = [{ id: '1', name: null as any, value: 20 }];

      const result = mergeArrayById(defaultItems, userItems);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: '1', name: 'default', value: 20 });
    });

    it('should ignore undefined values in user items', () => {
      const defaultItems: TestItem[] = [{ id: '1', name: 'default', value: 10 }];
      const userItems: TestItem[] = [{ id: '1', name: undefined, value: 20 }];

      const result = mergeArrayById(defaultItems, userItems);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: '1', name: 'default', value: 20 });
    });

    it('should ignore empty objects in user items', () => {
      const defaultItems: TestItem[] = [
        { id: '1', name: 'default', metadata: { key: 'value' } },
      ];
      const userItems: TestItem[] = [{ id: '1', metadata: {} }];

      const result = mergeArrayById(defaultItems, userItems);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: '1', name: 'default', metadata: { key: 'value' } });
    });

    it('should merge non-empty nested objects', () => {
      const defaultItems: TestItem[] = [
        { id: '1', name: 'default', metadata: { key1: 'value1', key2: 'value2' } },
      ];
      const userItems: TestItem[] = [{ id: '1', metadata: { key2: 'newValue2', key3: 'value3' } }];

      const result = mergeArrayById(defaultItems, userItems);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: '1',
        name: 'default',
        metadata: { key1: 'value1', key2: 'newValue2', key3: 'value3' },
      });
    });
  });

  describe('handling duplicate IDs', () => {
    it('should handle duplicate IDs in user items (last one wins)', () => {
      const defaultItems: TestItem[] = [{ id: '1', name: 'default', value: 10 }];
      const userItems: TestItem[] = [
        { id: '1', value: 20 },
        { id: '1', value: 30 },
        { id: '1', value: 40 },
      ];

      const result = mergeArrayById(defaultItems, userItems);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: '1', name: 'default', value: 40 });
    });

    it('should handle duplicate IDs in default items', () => {
      const defaultItems: TestItem[] = [
        { id: '1', name: 'default1', value: 10 },
        { id: '1', name: 'default2', value: 20 },
      ];
      const userItems: TestItem[] = [{ id: '1', value: 100 }];

      const result = mergeArrayById(defaultItems, userItems);

      // First default item should be used for merging
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('should handle empty default array', () => {
      const defaultItems: TestItem[] = [];
      const userItems: TestItem[] = [
        { id: '1', name: 'user1', value: 10 },
        { id: '2', name: 'user2', value: 20 },
      ];

      const result = mergeArrayById(defaultItems, userItems);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ id: '1', name: 'user1', value: 10 });
      expect(result).toContainEqual({ id: '2', name: 'user2', value: 20 });
    });

    it('should handle empty user array', () => {
      const defaultItems: TestItem[] = [
        { id: '1', name: 'default1', value: 10 },
        { id: '2', name: 'default2', value: 20 },
      ];
      const userItems: TestItem[] = [];

      const result = mergeArrayById(defaultItems, userItems);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ id: '1', name: 'default1', value: 10 });
      expect(result).toContainEqual({ id: '2', name: 'default2', value: 20 });
    });

    it('should handle both empty arrays', () => {
      const defaultItems: TestItem[] = [];
      const userItems: TestItem[] = [];

      const result = mergeArrayById(defaultItems, userItems);

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should handle items only in user array', () => {
      const defaultItems: TestItem[] = [{ id: '1', name: 'default1', value: 10 }];
      const userItems: TestItem[] = [
        { id: '2', name: 'user2', value: 20 },
        { id: '3', name: 'user3', value: 30 },
      ];

      const result = mergeArrayById(defaultItems, userItems);

      expect(result).toHaveLength(3);
      expect(result).toContainEqual({ id: '1', name: 'default1', value: 10 });
      expect(result).toContainEqual({ id: '2', name: 'user2', value: 20 });
      expect(result).toContainEqual({ id: '3', name: 'user3', value: 30 });
    });

    it('should handle items only in default array', () => {
      const defaultItems: TestItem[] = [
        { id: '1', name: 'default1', value: 10 },
        { id: '2', name: 'default2', value: 20 },
        { id: '3', name: 'default3', value: 30 },
      ];
      const userItems: TestItem[] = [];

      const result = mergeArrayById(defaultItems, userItems);

      expect(result).toHaveLength(3);
      expect(result).toContainEqual({ id: '1', name: 'default1', value: 10 });
      expect(result).toContainEqual({ id: '2', name: 'default2', value: 20 });
      expect(result).toContainEqual({ id: '3', name: 'default3', value: 30 });
    });
  });

  describe('complex scenarios', () => {
    it('should handle complex nested metadata merging', () => {
      const defaultItems: TestItem[] = [
        {
          id: '1',
          name: 'default',
          metadata: {
            config: { enabled: true, timeout: 1000 },
            tags: ['default'],
          },
        },
      ];
      const userItems: TestItem[] = [
        {
          id: '1',
          metadata: {
            config: { timeout: 2000, retries: 3 },
            description: 'User description',
          },
        },
      ];

      const result = mergeArrayById(defaultItems, userItems);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: '1',
        name: 'default',
        metadata: {
          config: { enabled: true, timeout: 2000, retries: 3 },
          tags: ['default'],
          description: 'User description',
        },
      });
    });

    it('should handle mixed scenario with overlapping and non-overlapping items', () => {
      const defaultItems: TestItem[] = [
        { id: '1', name: 'default1', value: 10 },
        { id: '2', name: 'default2', value: 20 },
        { id: '3', name: 'default3', value: 30 },
      ];
      const userItems: TestItem[] = [
        { id: '2', value: 200 },
        { id: '4', name: 'user4', value: 40 },
        { id: '1', name: 'user1' },
      ];

      const result = mergeArrayById(defaultItems, userItems);

      expect(result).toHaveLength(4);
      expect(result).toContainEqual({ id: '1', name: 'user1', value: 10 });
      expect(result).toContainEqual({ id: '2', name: 'default2', value: 200 });
      expect(result).toContainEqual({ id: '3', name: 'default3', value: 30 });
      expect(result).toContainEqual({ id: '4', name: 'user4', value: 40 });
    });

    it('should maintain order based on processing logic', () => {
      const defaultItems: TestItem[] = [
        { id: '1', name: 'default1' },
        { id: '2', name: 'default2' },
        { id: '3', name: 'default3' },
      ];
      const userItems: TestItem[] = [
        { id: '3', value: 30 },
        { id: '1', value: 10 },
        { id: '4', name: 'user4', value: 40 },
      ];

      const result = mergeArrayById(defaultItems, userItems);

      // Map maintains insertion order: user items first, then default-only items
      expect(result).toHaveLength(4);
      const ids = result.map((item) => item.id);
      // User items are processed first (3, 1, 4), then default item that wasn't in user (2)
      expect(ids.indexOf('3')).toBeLessThan(ids.indexOf('1'));
      expect(ids.indexOf('1')).toBeLessThan(ids.indexOf('4'));
      expect(ids.indexOf('4')).toBeLessThan(ids.indexOf('2'));
    });
  });
});
