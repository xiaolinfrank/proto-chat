import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AsyncLocalStorage } from './localStorage';

describe('AsyncLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize without errors when no previous data exists', () => {
      expect(() => new AsyncLocalStorage<{ theme: string }>('LOBE_PREFERENCE')).not.toThrow();
    });

    it('should migrate LOBE_GLOBAL preference data to LOBE_PREFERENCE', () => {
      const oldData = {
        state: {
          preference: { theme: 'dark', language: 'en' },
        },
      };
      localStorage.setItem('LOBE_GLOBAL', JSON.stringify(oldData));

      new AsyncLocalStorage<any>('LOBE_PREFERENCE');

      const migrated = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(migrated).toEqual({ theme: 'dark', language: 'en' });
    });

    it('should remove the old LOBE_GLOBAL key after migration', () => {
      const oldData = {
        state: {
          preference: { theme: 'dark' },
        },
      };
      localStorage.setItem('LOBE_GLOBAL', JSON.stringify(oldData));

      new AsyncLocalStorage<any>('LOBE_PREFERENCE');

      expect(localStorage.getItem('LOBE_GLOBAL')).toBeNull();
    });

    it('should remove LOBE_GLOBAL even when state has no preference field', () => {
      const oldData = {
        state: {
          someOtherKey: 'value',
        },
      };
      localStorage.setItem('LOBE_GLOBAL', JSON.stringify(oldData));

      new AsyncLocalStorage<any>('LOBE_PREFERENCE');

      expect(localStorage.getItem('LOBE_GLOBAL')).toBeNull();
      expect(localStorage.getItem('LOBE_PREFERENCE')).toBeNull();
    });

    it('should not set LOBE_PREFERENCE when state has no preference field', () => {
      const oldData = {
        state: {
          other: 'data',
        },
      };
      localStorage.setItem('LOBE_GLOBAL', JSON.stringify(oldData));

      new AsyncLocalStorage<any>('LOBE_SYSTEM_STATUS');

      expect(localStorage.getItem('LOBE_PREFERENCE')).toBeNull();
    });

    it('should work correctly when initialized with LOBE_SYSTEM_STATUS key', () => {
      expect(() => new AsyncLocalStorage<any>('LOBE_SYSTEM_STATUS')).not.toThrow();
    });

    it('should skip migration when window is undefined (SSR environment)', () => {
      vi.stubGlobal('window', undefined);

      expect(() => new AsyncLocalStorage<any>('LOBE_PREFERENCE')).not.toThrow();
    });
  });

  describe('saveToLocalStorage', () => {
    it('should persist state as JSON to the configured key', async () => {
      const storage = new AsyncLocalStorage<{ theme: string }>('LOBE_PREFERENCE');
      await storage.saveToLocalStorage({ theme: 'dark' });

      const stored = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(stored).toEqual({ theme: 'dark' });
    });

    it('should merge new state with existing stored data', async () => {
      const storage = new AsyncLocalStorage<{ theme: string; language: string }>(
        'LOBE_PREFERENCE',
      );
      await storage.saveToLocalStorage({ theme: 'dark' });
      await storage.saveToLocalStorage({ language: 'en' });

      const stored = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(stored).toEqual({ theme: 'dark', language: 'en' });
    });

    it('should overwrite existing keys when the same key appears in new state', async () => {
      const storage = new AsyncLocalStorage<{ theme: string }>('LOBE_PREFERENCE');
      await storage.saveToLocalStorage({ theme: 'dark' });
      await storage.saveToLocalStorage({ theme: 'light' });

      const stored = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(stored).toEqual({ theme: 'light' });
    });

    it('should save to LOBE_SYSTEM_STATUS when that key is configured', async () => {
      const storage = new AsyncLocalStorage<{ sidebar: boolean }>('LOBE_SYSTEM_STATUS');
      await storage.saveToLocalStorage({ sidebar: true });

      const stored = JSON.parse(localStorage.getItem('LOBE_SYSTEM_STATUS') || '{}');
      expect(stored).toEqual({ sidebar: true });
    });

    it('should not cross-pollute between different storage keys', async () => {
      const prefStorage = new AsyncLocalStorage<{ theme: string }>('LOBE_PREFERENCE');
      const statusStorage = new AsyncLocalStorage<{ sidebar: boolean }>('LOBE_SYSTEM_STATUS');

      await prefStorage.saveToLocalStorage({ theme: 'dark' });
      await statusStorage.saveToLocalStorage({ sidebar: true });

      const pref = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      const status = JSON.parse(localStorage.getItem('LOBE_SYSTEM_STATUS') || '{}');
      expect(pref).toEqual({ theme: 'dark' });
      expect(status).toEqual({ sidebar: true });
    });

    it('should save empty object correctly', async () => {
      const storage = new AsyncLocalStorage<Record<string, never>>('LOBE_PREFERENCE');
      await storage.saveToLocalStorage({});

      const stored = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || 'null');
      expect(stored).toEqual({});
    });
  });

  describe('getFromLocalStorage', () => {
    it('should return empty object when storage is empty', async () => {
      const storage = new AsyncLocalStorage<{ theme: string }>('LOBE_PREFERENCE');
      const result = await storage.getFromLocalStorage();
      expect(result).toEqual({});
    });

    it('should return previously stored data', async () => {
      localStorage.setItem('LOBE_PREFERENCE', JSON.stringify({ theme: 'dark' }));
      const storage = new AsyncLocalStorage<{ theme: string }>('LOBE_PREFERENCE');
      const result = await storage.getFromLocalStorage();
      expect(result).toEqual({ theme: 'dark' });
    });

    it('should return data from a different key when specified', async () => {
      localStorage.setItem('LOBE_SYSTEM_STATUS', JSON.stringify({ sidebar: true }));
      const storage = new AsyncLocalStorage<any>('LOBE_PREFERENCE');
      const result = await storage.getFromLocalStorage('LOBE_SYSTEM_STATUS');
      expect(result).toEqual({ sidebar: true });
    });

    it('should return empty object when the key holds an empty JSON object', async () => {
      localStorage.setItem('LOBE_PREFERENCE', '{}');
      const storage = new AsyncLocalStorage<any>('LOBE_PREFERENCE');
      const result = await storage.getFromLocalStorage();
      expect(result).toEqual({});
    });

    it('should reflect data saved via saveToLocalStorage', async () => {
      const storage = new AsyncLocalStorage<{ count: number }>('LOBE_PREFERENCE');
      await storage.saveToLocalStorage({ count: 42 });
      const result = await storage.getFromLocalStorage();
      expect(result).toEqual({ count: 42 });
    });

    it('should default to the instance storage key when no key is passed', async () => {
      const storage = new AsyncLocalStorage<{ x: number }>('LOBE_SYSTEM_STATUS');
      localStorage.setItem('LOBE_SYSTEM_STATUS', JSON.stringify({ x: 7 }));
      const result = await storage.getFromLocalStorage();
      expect(result).toEqual({ x: 7 });
    });
  });
});
