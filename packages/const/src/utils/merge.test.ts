import { describe, expect, it } from 'vitest';

import { merge, mergeArrayById } from './merge';

describe('merge', () => {
  it('should merge two plain objects', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };
    expect(merge(target, source)).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('should not mutate the target object', () => {
    const target = { a: 1 };
    const source = { b: 2 };
    merge(target, source);
    expect(target).toEqual({ a: 1 });
  });

  it('should replace arrays instead of merging them', () => {
    const target = { items: [1, 2, 3] };
    const source = { items: [4, 5] };
    expect(merge(target, source)).toEqual({ items: [4, 5] });
  });

  it('should deep merge nested objects', () => {
    const target = { nested: { a: 1, b: 2 } };
    const source = { nested: { b: 3, c: 4 } };
    expect(merge(target, source)).toEqual({ nested: { a: 1, b: 3, c: 4 } });
  });

  it('should replace nested arrays', () => {
    const target = { nested: { arr: [1, 2, 3] } };
    const source = { nested: { arr: [4] } };
    expect(merge(target, source)).toEqual({ nested: { arr: [4] } });
  });

  it('should handle undefined source values by keeping target values', () => {
    const target = { a: 1, b: 2 };
    const source = { a: undefined } as { a: number | undefined; b?: number };
    const result = merge(target, source);
    expect(result['a']).toBe(1);
    expect(result['b']).toBe(2);
  });

  it('should handle empty objects', () => {
    expect(merge({}, {})).toEqual({});
    expect(merge({ a: 1 }, {})).toEqual({ a: 1 });
    expect(merge({}, { a: 1 })).toEqual({ a: 1 });
  });

  it('should source values override target for primitives', () => {
    const target = { str: 'hello', num: 1, bool: true };
    const source = { str: 'world', num: 2, bool: false };
    expect(merge(target, source)).toEqual({ str: 'world', num: 2, bool: false });
  });

  it('should handle null values from source', () => {
    const target = { a: 1 };
    const source = { a: null } as { a: number | null };
    const result = merge(target, source);
    expect(result['a']).toBeNull();
  });
});

describe('mergeArrayById', () => {
  it('should merge user items with matching default items', () => {
    const defaults = [{ id: '1', name: 'Default', value: 10 }];
    const userItems = [{ id: '1', name: 'User Override' }];
    const result = mergeArrayById(defaults, userItems);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: '1', name: 'User Override', value: 10 });
  });

  it('should include default items not in user items', () => {
    const defaults = [
      { id: '1', name: 'First' },
      { id: '2', name: 'Second' },
    ];
    const userItems = [{ id: '1', name: 'User First' }];
    const result = mergeArrayById(defaults, userItems);
    expect(result).toHaveLength(2);
    expect(result.some((item) => item.id === '2' && item.name === 'Second')).toBe(true);
  });

  it('should include user items that have no matching default', () => {
    const defaults = [{ id: '1', name: 'Default' }];
    const userItems = [{ id: '2', name: 'New User Item' }];
    const result = mergeArrayById(defaults, userItems);
    expect(result).toHaveLength(2);
    expect(result.some((item) => item.id === '2' && item.name === 'New User Item')).toBe(true);
  });

  it('should skip null values from user items when merging', () => {
    const defaults = [{ id: '1', name: 'Default', score: 100 }];
    const userItems = [{ id: '1', name: null as unknown as string, score: 200 }];
    const result = mergeArrayById(defaults, userItems);
    expect(result[0].name).toBe('Default');
    expect(result[0].score).toBe(200);
  });

  it('should skip undefined values from user items when merging', () => {
    const defaults = [{ id: '1', name: 'Default', score: 100 }];
    const userItems = [{ id: '1', name: undefined as unknown as string, score: 50 }];
    const result = mergeArrayById(defaults, userItems);
    expect(result[0].name).toBe('Default');
    expect(result[0].score).toBe(50);
  });

  it('should skip empty object values from user items when merging', () => {
    const defaults = [{ id: '1', config: { timeout: 5000 } }];
    const userItems = [{ id: '1', config: {} }];
    const result = mergeArrayById(defaults, userItems);
    expect(result[0].config).toEqual({ timeout: 5000 });
  });

  it('should deep merge nested objects from user items', () => {
    const defaults = [{ id: '1', config: { timeout: 5000, retries: 3 } }];
    const userItems = [{ id: '1', config: { timeout: 10000 } }];
    const result = mergeArrayById(defaults, userItems);
    expect(result[0].config).toEqual({ timeout: 10000, retries: 3 });
  });

  it('should handle empty arrays for both inputs', () => {
    expect(mergeArrayById([], [])).toEqual([]);
  });

  it('should handle empty defaults', () => {
    const userItems = [{ id: '1', name: 'User Only' }];
    const result = mergeArrayById([], userItems);
    expect(result).toEqual([{ id: '1', name: 'User Only' }]);
  });

  it('should handle empty userItems', () => {
    const defaults = [{ id: '1', name: 'Default Only' }];
    const result = mergeArrayById(defaults, []);
    expect(result).toEqual([{ id: '1', name: 'Default Only' }]);
  });

  it('should handle duplicate ids in user items — last one wins', () => {
    const defaults = [{ id: '1', name: 'Default' }];
    const userItems = [
      { id: '1', name: 'First User' },
      { id: '1', name: 'Second User' },
    ];
    const result = mergeArrayById(defaults, userItems);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Second User');
  });

  it('should preserve all fields from the default item not overridden by user', () => {
    const defaults = [{ description: 'desc', id: '1', label: 'label', name: 'Default' }];
    const userItems = [{ id: '1', name: 'Override' }];
    const result = mergeArrayById(defaults, userItems);
    expect(result[0]).toMatchObject({
      description: 'desc',
      id: '1',
      label: 'label',
      name: 'Override',
    });
  });
});
