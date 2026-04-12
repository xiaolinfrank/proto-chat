import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AsyncLocalStorage } from './localStorage';

describe('AsyncLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('constructor', () => {
    it('should initialize with the given storage key', async () => {
      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');
      // No error on construction
      const result = await storage.getFromLocalStorage();
      expect(result).toEqual({});
    });

    it('should migrate old LOBE_GLOBAL data to LOBE_PREFERENCE key', () => {
      const oldData = {
        state: {
          preference: { theme: 'dark', language: 'en' },
        },
      };
      localStorage.setItem('LOBE_GLOBAL', JSON.stringify(oldData));

      // Constructor should trigger migration
      new AsyncLocalStorage('LOBE_PREFERENCE');

      // Old key should be removed
      expect(localStorage.getItem('LOBE_GLOBAL')).toBeNull();

      // Preference data should be migrated to LOBE_PREFERENCE
      const migratedData = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(migratedData).toEqual(oldData.state.preference);
    });

    it('should not fail if old LOBE_GLOBAL data has no preference', () => {
      const oldData = { state: {} };
      localStorage.setItem('LOBE_GLOBAL', JSON.stringify(oldData));

      // Should not throw
      expect(() => new AsyncLocalStorage('LOBE_SYSTEM_STATUS')).not.toThrow();

      // Old key should still be removed
      expect(localStorage.getItem('LOBE_GLOBAL')).toBeNull();
    });

    it('should not migrate if LOBE_GLOBAL does not exist', () => {
      // No LOBE_GLOBAL key set
      new AsyncLocalStorage('LOBE_PREFERENCE');

      // Nothing should be migrated; LOBE_PREFERENCE should remain empty
      expect(localStorage.getItem('LOBE_PREFERENCE')).toBeNull();
    });
  });

  describe('saveToLocalStorage', () => {
    it('should save state to localStorage under the configured key', async () => {
      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');
      await storage.saveToLocalStorage({ theme: 'dark' });

      const stored = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(stored).toEqual({ theme: 'dark' });
    });

    it('should merge new state with existing state', async () => {
      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');
      await storage.saveToLocalStorage({ theme: 'dark' });
      await storage.saveToLocalStorage({ language: 'en' });

      const stored = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(stored).toEqual({ theme: 'dark', language: 'en' });
    });

    it('should overwrite existing values when keys conflict', async () => {
      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');
      await storage.saveToLocalStorage({ theme: 'dark' });
      await storage.saveToLocalStorage({ theme: 'light' });

      const stored = JSON.parse(localStorage.getItem('LOBE_PREFERENCE') || '{}');
      expect(stored).toEqual({ theme: 'light' });
    });

    it('should save state with nested objects', async () => {
      const storage = new AsyncLocalStorage('LOBE_SYSTEM_STATUS');
      const nestedState = { sidebar: { width: 240, collapsed: false } };
      await storage.saveToLocalStorage(nestedState);

      const stored = JSON.parse(localStorage.getItem('LOBE_SYSTEM_STATUS') || '{}');
      expect(stored).toEqual(nestedState);
    });
  });

  describe('getFromLocalStorage', () => {
    it('should return empty object when nothing is stored', async () => {
      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');
      const result = await storage.getFromLocalStorage();
      expect(result).toEqual({});
    });

    it('should return stored state', async () => {
      const data = { theme: 'dark', language: 'zh-CN' };
      localStorage.setItem('LOBE_PREFERENCE', JSON.stringify(data));

      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');
      const result = await storage.getFromLocalStorage();
      expect(result).toEqual(data);
    });

    it('should return data from specified key when passed explicitly', async () => {
      const systemData = { collapsed: true };
      localStorage.setItem('LOBE_SYSTEM_STATUS', JSON.stringify(systemData));

      const storage = new AsyncLocalStorage('LOBE_PREFERENCE');
      const result = await storage.getFromLocalStorage('LOBE_SYSTEM_STATUS');
      expect(result).toEqual(systemData);
    });

    it('should return empty object for a key with no stored data', async () => {
      const storage = new AsyncLocalStorage('LOBE_SYSTEM_STATUS');
      const result = await storage.getFromLocalStorage('LOBE_PREFERENCE');
      expect(result).toEqual({});
    });
  });
});
