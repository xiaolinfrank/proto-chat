// @vitest-environment node
import { nanoid } from 'nanoid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiKeyManager } from './apiKeyManager';

function generateKeys(count: number = 1) {
  return new Array(count)
    .fill('')
    .map(() => {
      return `sk-${nanoid()}`;
    })
    .join(',');
}

// Stub the global process object to safely mock environment variables
vi.stubGlobal('process', {
  ...process, // Preserve the original process object
  env: { ...process.env }, // Clone the environment variables object for modification
});

describe('apiKeyManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('API Key unset or empty', () => {
    it('should return an empty string when API_KEY_SELECT_MODE is unset', () => {
      const apiKeyManager = new ApiKeyManager();

      expect(apiKeyManager.pick('')).toBe('');
      expect(apiKeyManager.pick()).toBe('');
    });

    it('should return an empty string when API_KEY_SELECT_MODE is "random"', () => {
      process.env.API_KEY_SELECT_MODE = 'random';
      const apiKeyManager = new ApiKeyManager();

      expect(apiKeyManager.pick('')).toBe('');
      expect(apiKeyManager.pick()).toBe('');
    });

    it('should return an empty string when API_KEY_SELECT_MODE is "turn"', () => {
      process.env.API_KEY_SELECT_MODE = 'turn';
      const apiKeyManager = new ApiKeyManager();

      expect(apiKeyManager.pick('')).toBe('');
      expect(apiKeyManager.pick()).toBe('');
    });
  });

  describe('single API Key', () => {
    it('should return the only API Key when API_KEY_SELECT_MODE is unset', () => {
      const apiKeyManager = new ApiKeyManager();
      const apiKeyStr = generateKeys(1);

      expect(apiKeyManager.pick(apiKeyStr)).toBe(apiKeyStr);
    });

    it('should return the only API when API_KEY_SELECT_MODE is "random"', () => {
      process.env.API_KEY_SELECT_MODE = 'random';
      const apiKeyStr = generateKeys(1);
      const apiKeyManager = new ApiKeyManager();

      expect(apiKeyManager.pick(apiKeyStr)).toBe(apiKeyStr);
      // multiple
      expect(apiKeyManager.pick(apiKeyStr)).toBe(apiKeyStr);
      expect(apiKeyManager.pick(apiKeyStr)).toBe(apiKeyStr);
    });

    it('should return the only API when API_KEY_SELECT_MODE is "turn"', () => {
      process.env.API_KEY_SELECT_MODE = 'turn';
      const apiKeyStr = generateKeys(1);
      const apiKeyManager = new ApiKeyManager();

      expect(apiKeyManager.pick(apiKeyStr)).toBe(apiKeyStr);
      // multiple
      expect(apiKeyManager.pick(apiKeyStr)).toBe(apiKeyStr);
    });
  });

  describe('multiple API Keys', () => {
    it('should return a random API Key when API_KEY_SELECT_MODE is unset', () => {
      const apiKeyStr = generateKeys(5);
      const apiKeys = apiKeyStr.split(',');
      const apiKeyManager = new ApiKeyManager();
      const keyLen = apiKeys.length * 2; // multiple round

      for (let i = 0; i < keyLen; i++) {
        expect(apiKeys).toContain(apiKeyManager.pick(apiKeyStr));
      }
    });

    it('should return a random API Key when environment variable of API_KEY_SELECT_MODE is "random"', () => {
      process.env.API_KEY_SELECT_MODE = 'random';
      const apiKeyStr = generateKeys(5);
      const apiKeys = apiKeyStr.split(',');
      const apiKeyManager = new ApiKeyManager();
      const keyLen = apiKeys.length * 2; // multiple round

      for (let i = 0; i < keyLen; i++) {
        expect(apiKeys).toContain(apiKeyManager.pick(apiKeyStr));
      }
    });

    it('should return API Keys sequentially when environment variable of API_KEY_SELECT_MODE is "turn"', () => {
      process.env.API_KEY_SELECT_MODE = 'turn';
      const apiKeyStr = generateKeys(5);
      const apiKeys = apiKeyStr.split(',');
      const apiKeyManager = new ApiKeyManager();

      const total = apiKeys.length;
      const rounds = total * 2;
      for (let i = 0; i < total; i++) {
        expect(apiKeyManager.pick(apiKeyStr)).toBe(apiKeys[i % total]);
      }
    });

    it('should return a random API Key when API_KEY_SELECT_MODE is anything other than "random" or "turn"', () => {
      process.env.API_KEY_SELECT_MODE = nanoid();
      const apiKeyStr = generateKeys(5);
      const apiKeys = apiKeyStr.split(',');
      const apiKeyManager = new ApiKeyManager();
      const keyLen = apiKeys.length * 2; // multiple round

      for (let i = 0; i < keyLen; i++) {
        expect(apiKeys).toContain(apiKeyManager.pick(apiKeyStr));
      }
    });
  });

  describe('whitespace and formatting edge cases', () => {
    it('should handle API keys with leading and trailing whitespace', () => {
      process.env.API_KEY_SELECT_MODE = 'turn';
      const keys = ['  key1  ', ' key2 ', 'key3  '];
      const apiKeyStr = keys.join(',');
      const apiKeyManager = new ApiKeyManager();

      // Keys are NOT trimmed, they retain whitespace
      expect(apiKeyManager.pick(apiKeyStr)).toBe(keys[0]);
      expect(apiKeyManager.pick(apiKeyStr)).toBe(keys[1]);
      expect(apiKeyManager.pick(apiKeyStr)).toBe(keys[2]);
    });

    it('should filter out empty strings between commas', () => {
      process.env.API_KEY_SELECT_MODE = 'turn';
      const keys = ['key1', 'key2'];
      const apiKeyStr = `${keys[0]},,${keys[1]},,,`;
      const apiKeyManager = new ApiKeyManager();

      // Should only have 2 valid keys
      expect(apiKeyManager.pick(apiKeyStr)).toBe(keys[0]);
      expect(apiKeyManager.pick(apiKeyStr)).toBe(keys[1]);
      expect(apiKeyManager.pick(apiKeyStr)).toBe(keys[0]); // Wraps around
    });

    it('should handle API keys that are only whitespace', () => {
      process.env.API_KEY_SELECT_MODE = 'turn';
      const keys = ['key1', 'key2'];
      const apiKeyStr = `${keys[0]},   ,${keys[1]},  \t  `;
      const apiKeyManager = new ApiKeyManager();

      // Should filter out whitespace-only keys
      expect(apiKeyManager.pick(apiKeyStr)).toBe(keys[0]);
      expect(apiKeyManager.pick(apiKeyStr)).toBe(keys[1]);
      expect(apiKeyManager.pick(apiKeyStr)).toBe(keys[0]); // Wraps around
    });
  });

  describe('cache mechanism', () => {
    it('should cache parsed keys and reuse them for the same API key string', () => {
      process.env.API_KEY_SELECT_MODE = 'turn';
      const apiKeyStr = generateKeys(3);
      const apiKeys = apiKeyStr.split(',');
      const apiKeyManager = new ApiKeyManager();

      // First call should parse and cache
      expect(apiKeyManager.pick(apiKeyStr)).toBe(apiKeys[0]);
      expect(apiKeyManager.pick(apiKeyStr)).toBe(apiKeys[1]);

      // Calling with the same string should use cache and continue from index 2
      expect(apiKeyManager.pick(apiKeyStr)).toBe(apiKeys[2]);
      expect(apiKeyManager.pick(apiKeyStr)).toBe(apiKeys[0]); // Wraps to start
    });

    it('should maintain separate cache entries for different API key strings', () => {
      process.env.API_KEY_SELECT_MODE = 'turn';
      const apiKeyStr1 = 'key1,key2,key3';
      const apiKeyStr2 = 'keyA,keyB,keyC';
      const apiKeyManager = new ApiKeyManager();

      // First key string
      expect(apiKeyManager.pick(apiKeyStr1)).toBe('key1');
      expect(apiKeyManager.pick(apiKeyStr1)).toBe('key2');

      // Second key string (should start from index 0)
      expect(apiKeyManager.pick(apiKeyStr2)).toBe('keyA');
      expect(apiKeyManager.pick(apiKeyStr2)).toBe('keyB');

      // Back to first key string (should continue from index 2)
      expect(apiKeyManager.pick(apiKeyStr1)).toBe('key3');
      expect(apiKeyManager.pick(apiKeyStr1)).toBe('key1'); // Wraps around
    });

    it('should not cache in random mode but still parse correctly', () => {
      process.env.API_KEY_SELECT_MODE = 'random';
      const apiKeyStr = 'key1,key2,key3';
      const apiKeys = apiKeyStr.split(',');
      const apiKeyManager = new ApiKeyManager();

      // In random mode, cache should still be used for parsing
      // but index selection is random
      for (let i = 0; i < 10; i++) {
        expect(apiKeys).toContain(apiKeyManager.pick(apiKeyStr));
      }
    });
  });

  describe('round-robin wrapping', () => {
    it('should wrap around to the first key after reaching the last key in turn mode', () => {
      process.env.API_KEY_SELECT_MODE = 'turn';
      const keys = ['key1', 'key2', 'key3'];
      const apiKeyStr = keys.join(',');
      const apiKeyManager = new ApiKeyManager();

      // Go through all keys
      expect(apiKeyManager.pick(apiKeyStr)).toBe(keys[0]);
      expect(apiKeyManager.pick(apiKeyStr)).toBe(keys[1]);
      expect(apiKeyManager.pick(apiKeyStr)).toBe(keys[2]);

      // Should wrap around to the first key
      expect(apiKeyManager.pick(apiKeyStr)).toBe(keys[0]);
      expect(apiKeyManager.pick(apiKeyStr)).toBe(keys[1]);
      expect(apiKeyManager.pick(apiKeyStr)).toBe(keys[2]);

      // Second wrap
      expect(apiKeyManager.pick(apiKeyStr)).toBe(keys[0]);
    });

    it('should handle multiple complete cycles in turn mode', () => {
      process.env.API_KEY_SELECT_MODE = 'turn';
      const keys = ['key1', 'key2'];
      const apiKeyStr = keys.join(',');
      const apiKeyManager = new ApiKeyManager();

      // Test 5 complete cycles (10 picks)
      for (let cycle = 0; cycle < 5; cycle++) {
        expect(apiKeyManager.pick(apiKeyStr)).toBe(keys[0]);
        expect(apiKeyManager.pick(apiKeyStr)).toBe(keys[1]);
      }
    });
  });

  describe('special input cases', () => {
    it('should handle a single key with trailing comma', () => {
      const apiKeyStr = 'single-key,';
      const apiKeyManager = new ApiKeyManager();

      expect(apiKeyManager.pick(apiKeyStr)).toBe('single-key');
    });

    it('should handle a single key with leading comma', () => {
      const apiKeyStr = ',single-key';
      const apiKeyManager = new ApiKeyManager();

      expect(apiKeyManager.pick(apiKeyStr)).toBe('single-key');
    });

    it('should return undefined for comma-only input', () => {
      const apiKeyManager = new ApiKeyManager();

      // When all keys are filtered out, returns undefined
      expect(apiKeyManager.pick(',')).toBeUndefined();
      expect(apiKeyManager.pick(',,,,')).toBeUndefined();
    });

    it('should return undefined for whitespace-only input', () => {
      const apiKeyManager = new ApiKeyManager();

      // Whitespace-only strings are filtered out, leaving empty array
      expect(apiKeyManager.pick('   ')).toBeUndefined();
      expect(apiKeyManager.pick('\t\n')).toBeUndefined();
    });
  });
});
