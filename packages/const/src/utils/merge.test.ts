import { describe, expect, it } from 'vitest';

import { merge, mergeArrayById } from './merge';

describe('merge', () => {
  it('should merge two simple objects', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };
    expect(merge(target, source)).toEqual({ a: 1, b: 3, c: 4 });
  });

  it('should not mutate the original objects', () => {
    const target = { a: 1 };
    const source = { b: 2 };
    const result = merge(target, source);
    expect(result).not.toBe(target);
    expect(result).not.toBe(source);
    expect(target).toEqual({ a: 1 });
    expect(source).toEqual({ b: 2 });
  });

  it('should replace arrays instead of merging them', () => {
    const target = { arr: [1, 2, 3] };
    const source = { arr: [4, 5] };
    expect(merge(target, source)).toEqual({ arr: [4, 5] });
  });

  it('should deep merge nested objects', () => {
    const target = { nested: { a: 1, b: 2 } };
    const source = { nested: { b: 3, c: 4 } };
    expect(merge(target, source)).toEqual({ nested: { a: 1, b: 3, c: 4 } });
  });

  it('should handle empty source', () => {
    const target = { a: 1 };
    expect(merge(target, {})).toEqual({ a: 1 });
  });

  it('should handle empty target', () => {
    const source = { a: 1 };
    expect(merge({}, source)).toEqual({ a: 1 });
  });

  it('should override with source values including falsy values', () => {
    const target = { a: 1, b: 'hello' };
    const source = { a: 0, b: '' };
    const result = merge(target, source);
    expect(result.a).toBe(0);
    expect(result.b).toBe('');
  });
});

describe('mergeArrayById', () => {
  it('should merge arrays by id, user items take priority', () => {
    const defaultItems: Array<{ id: string; name: string; meta: string }> = [
      { id: 'a', name: 'Default A', meta: 'default-meta' },
      { id: 'b', name: 'Default B', meta: 'default-meta' },
    ];
    const userItems = [{ id: 'a', name: 'User A', meta: 'default-meta' }];

    const result = mergeArrayById(defaultItems, userItems);
    const itemA = result.find((i) => i.id === 'a');
    expect(itemA?.name).toBe('User A');
    expect(itemA?.meta).toBe('default-meta');
  });

  it('should include default-only items in the result', () => {
    const defaultItems = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    const userItems = [{ id: 'a', name: 'User A' }];

    const result = mergeArrayById(defaultItems, userItems);
    expect(result.find((i) => i.id === 'b')).toEqual({ id: 'b', name: 'B' });
  });

  it('should include user-only items (not in defaults) in the result', () => {
    const defaultItems = [{ id: 'a', name: 'A' }];
    const userItems = [{ id: 'z', name: 'Z' }];

    const result = mergeArrayById(defaultItems, userItems);
    expect(result.find((i) => i.id === 'z')).toEqual({ id: 'z', name: 'Z' });
  });

  it('should ignore null values from user items, keeping defaults', () => {
    const defaultItems = [{ id: 'a', name: 'Default Name' }];
    const userItems = [{ id: 'a', name: null as any }];

    const result = mergeArrayById(defaultItems, userItems);
    expect(result.find((i) => i.id === 'a')?.name).toBe('Default Name');
  });

  it('should ignore undefined values from user items, keeping defaults', () => {
    const defaultItems = [{ id: 'a', name: 'Default Name' }];
    const userItems = [{ id: 'a', name: undefined as any }];

    const result = mergeArrayById(defaultItems, userItems);
    expect(result.find((i) => i.id === 'a')?.name).toBe('Default Name');
  });

  it('should ignore empty objects from user items, keeping defaults', () => {
    const defaultItems = [{ id: 'a', config: { key: 'value' } }];
    const userItems = [{ id: 'a', config: {} }];

    const result = mergeArrayById(defaultItems, userItems);
    expect(result.find((i) => i.id === 'a')?.config).toEqual({ key: 'value' });
  });

  it('should deep merge non-empty nested objects', () => {
    type Item = { id: string; config: { key: string; extra: string } };
    const defaultItems: Item[] = [{ id: 'a', config: { key: 'default', extra: 'kept' } }];
    const userItems: Item[] = [{ id: 'a', config: { key: 'overridden', extra: 'kept' } }];

    const result = mergeArrayById(defaultItems, userItems);
    const item = result.find((i) => i.id === 'a');
    expect(item?.config.key).toBe('overridden');
    expect(item?.config.extra).toBe('kept');
  });

  it('should handle duplicate user item ids — last one wins', () => {
    const defaultItems = [{ id: 'a', name: 'Default' }];
    const userItems = [
      { id: 'a', name: 'First' },
      { id: 'a', name: 'Second' },
    ];

    const result = mergeArrayById(defaultItems, userItems);
    const items = result.filter((i) => i.id === 'a');
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Second');
  });

  it('should return empty array when both inputs are empty', () => {
    expect(mergeArrayById([], [])).toEqual([]);
  });

  it('should return all defaults when user items are empty', () => {
    const defaultItems = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    const result = mergeArrayById(defaultItems, []);
    expect(result).toEqual(defaultItems);
  });

  it('should return all user items when defaults are empty', () => {
    const userItems = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    const result = mergeArrayById([], userItems);
    expect(result).toEqual(userItems);
  });
});
