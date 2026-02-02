import { describe, expect, it } from 'vitest';

import { LOBE_URL_IMPORT_NAME } from '@/const/url';

import { shareService } from './share';

describe('ShareService', () => {
  describe('createShareSettingsUrl', () => {
    it('should create URL with simple settings', () => {
      const settings: any = {
        general: {
          fontSize: 14,
        },
      };

      const result = shareService.createShareSettingsUrl(settings);

      expect(result).toBe(`/?${LOBE_URL_IMPORT_NAME}=${encodeURI(JSON.stringify(settings))}`);
      expect(result).toContain('settings=');
      expect(result).toContain('general');
    });

    it('should create URL with nested settings object', () => {
      const settings: any = {
        general: {
          fontSize: 14,
          primaryColor: 'blue',
        },
      };

      const result = shareService.createShareSettingsUrl(settings);

      const expectedJson = JSON.stringify(settings);
      expect(result).toBe(`/?${LOBE_URL_IMPORT_NAME}=${encodeURI(expectedJson)}`);
      expect(result).toContain('general');
      expect(result).toContain('fontSize');
      expect(result).toContain('primaryColor');
    });

    it('should handle empty settings object', () => {
      const settings: any = {};

      const result = shareService.createShareSettingsUrl(settings);

      expect(result).toBe(`/?${LOBE_URL_IMPORT_NAME}=${encodeURI(JSON.stringify(settings))}`);
      expect(result).toBe('/?settings=%7B%7D');
    });

    it('should handle settings with special characters', () => {
      const settings: any = {
        general: { fontSize: 14 },
        customField: 'test with spaces & symbols!',
      };

      const result = shareService.createShareSettingsUrl(settings);

      expect(result).toContain('settings=');
      expect(result).toContain(encodeURI(JSON.stringify(settings)));
    });

    it('should handle deeply nested settings', () => {
      const settings: any = {
        languageModel: {
          openai: {
            apiKey: 'test-key',
            endpoint: 'https://api.openai.com',
          },
        },
      };

      const result = shareService.createShareSettingsUrl(settings);

      expect(result).toContain('settings=');
      expect(result).toContain('languageModel');
      expect(result).toContain('openai');
    });

    it('should handle settings with arrays', () => {
      const settings: any = {
        providers: ['openai', 'anthropic', 'azure'],
      };

      const result = shareService.createShareSettingsUrl(settings);

      expect(result).toContain('settings=');
      expect(result).toContain('providers');
    });

    it('should handle settings with null values', () => {
      const settings: any = {
        general: { fontSize: 14 },
        customField: null,
      };

      const result = shareService.createShareSettingsUrl(settings);

      expect(result).toContain('settings=');
      expect(result).toContain('null');
    });

    it('should handle settings with boolean values', () => {
      const settings: any = {
        enableFeature: true,
        disableFeature: false,
      };

      const result = shareService.createShareSettingsUrl(settings);

      expect(result).toContain('true');
      expect(result).toContain('false');
    });

    it('should handle settings with numeric values', () => {
      const settings: any = {
        general: {
          fontSize: 16,
        },
        maxTokens: 4096,
        temperature: 0.7,
      };

      const result = shareService.createShareSettingsUrl(settings);

      expect(result).toContain('fontSize');
      expect(result).toContain('4096');
      expect(result).toContain('0.7');
    });

    it('should always start with /? prefix', () => {
      const settings: any = { general: { fontSize: 14 } };

      const result = shareService.createShareSettingsUrl(settings);

      expect(result).toMatch(/^\/\?/);
    });
  });

  describe('decodeShareSettings', () => {
    it('should decode valid JSON string successfully', () => {
      const settings = {
        language: 'en-US',
        themeMode: 'dark',
      };
      const jsonString = JSON.stringify(settings);

      const result = shareService.decodeShareSettings(jsonString);

      expect(result).toHaveProperty('data');
      expect(result.data).toEqual(settings);
      expect(result).not.toHaveProperty('message');
    });

    it('should decode empty object successfully', () => {
      const jsonString = '{}';

      const result = shareService.decodeShareSettings(jsonString);

      expect(result).toHaveProperty('data');
      expect(result.data).toEqual({});
    });

    it('should decode complex nested object', () => {
      const settings = {
        language: 'zh-CN',
        languageModel: {
          openAI: {
            apiKey: 'test-key',
            endpoint: 'https://api.openai.com',
          },
        },
        plugins: ['plugin1', 'plugin2'],
      };
      const jsonString = JSON.stringify(settings);

      const result = shareService.decodeShareSettings(jsonString);

      expect(result).toHaveProperty('data');
      expect(result.data).toEqual(settings);
    });

    it('should handle invalid JSON and return error message', () => {
      const invalidJson = 'not a valid json';

      const result = shareService.decodeShareSettings(invalidJson);

      expect(result).not.toHaveProperty('data');
      expect(result).toHaveProperty('message');
      expect(result.message).toBeTruthy();
      expect(typeof result.message).toBe('string');
    });

    it('should handle malformed JSON with missing closing brace', () => {
      const malformedJson = '{"language":"en-US"';

      const result = shareService.decodeShareSettings(malformedJson);

      expect(result).not.toHaveProperty('data');
      expect(result).toHaveProperty('message');
    });

    it('should handle empty string', () => {
      const emptyString = '';

      const result = shareService.decodeShareSettings(emptyString);

      expect(result).not.toHaveProperty('data');
      expect(result).toHaveProperty('message');
    });

    it('should handle JSON with special characters', () => {
      const settings = {
        customField: 'test with spaces & symbols!',
        unicode: '你好世界 🌍',
      };
      const jsonString = JSON.stringify(settings);

      const result = shareService.decodeShareSettings(jsonString);

      expect(result).toHaveProperty('data');
      expect(result.data).toEqual(settings);
    });

    it('should handle JSON with null values', () => {
      const settings = {
        language: 'en-US',
        customField: null,
      };
      const jsonString = JSON.stringify(settings);

      const result = shareService.decodeShareSettings(jsonString);

      expect(result).toHaveProperty('data');
      expect(result.data).toEqual(settings);
    });

    it('should handle JSON with arrays', () => {
      const settings = {
        providers: ['openai', 'anthropic'],
        numbers: [1, 2, 3],
      };
      const jsonString = JSON.stringify(settings);

      const result = shareService.decodeShareSettings(jsonString);

      expect(result).toHaveProperty('data');
      expect(result.data).toEqual(settings);
    });

    it('should handle JSON with boolean values', () => {
      const settings = {
        enabled: true,
        disabled: false,
      };
      const jsonString = JSON.stringify(settings);

      const result = shareService.decodeShareSettings(jsonString);

      expect(result).toHaveProperty('data');
      expect(result.data).toEqual(settings);
    });

    it('should handle JSON with numeric values', () => {
      const settings = {
        fontSize: 16,
        temperature: 0.7,
        maxTokens: 4096,
      };
      const jsonString = JSON.stringify(settings);

      const result = shareService.decodeShareSettings(jsonString);

      expect(result).toHaveProperty('data');
      expect(result.data).toEqual(settings);
    });

    it('should handle JSON with deeply nested structures', () => {
      const settings = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      };
      const jsonString = JSON.stringify(settings);

      const result = shareService.decodeShareSettings(jsonString);

      expect(result).toHaveProperty('data');
      expect(result.data).toEqual(settings);
    });

    it('should handle unexpected input types gracefully', () => {
      const invalidInputs = [
        'undefined',
        'null',
        '[1,2,3]', // Array JSON is valid but unexpected for settings
        '123', // Number JSON is valid but unexpected
        '"string"', // String JSON is valid but unexpected
      ];

      invalidInputs.forEach((input) => {
        const result = shareService.decodeShareSettings(input);
        // Should either succeed with data or fail with message, never crash
        expect(result).toBeTruthy();
        expect(result).toSatisfy(
          (r: any) => r.hasOwnProperty('data') || r.hasOwnProperty('message'),
        );
      });
    });
  });

  describe('integration - encode and decode', () => {
    it('should encode and decode settings successfully', () => {
      const originalSettings: any = {
        general: {
          fontSize: 16,
          primaryColor: 'blue',
        },
      };

      // Create URL
      const url = shareService.createShareSettingsUrl(originalSettings);

      // Extract settings from URL
      const urlParams = new URLSearchParams(url.split('?')[1]);
      const encodedSettings = urlParams.get(LOBE_URL_IMPORT_NAME);

      expect(encodedSettings).toBeTruthy();

      // Decode settings
      const decodedResult = shareService.decodeShareSettings(encodedSettings!);

      expect(decodedResult).toHaveProperty('data');
      expect(decodedResult.data).toEqual(originalSettings);
    });

    it('should handle round-trip with complex nested settings', () => {
      const originalSettings: any = {
        languageModel: {
          openai: {
            apiKey: 'test-key',
            models: ['gpt-4', 'gpt-3.5-turbo'],
          },
        },
      };

      // Create URL
      const url = shareService.createShareSettingsUrl(originalSettings);

      // Extract and decode
      const urlParams = new URLSearchParams(url.split('?')[1]);
      const encodedSettings = urlParams.get(LOBE_URL_IMPORT_NAME);
      const decodedResult = shareService.decodeShareSettings(encodedSettings!);

      expect(decodedResult.data).toEqual(originalSettings);
    });

    it('should handle round-trip with empty settings', () => {
      const originalSettings: any = {};

      // Create URL
      const url = shareService.createShareSettingsUrl(originalSettings);

      // Extract and decode
      const urlParams = new URLSearchParams(url.split('?')[1]);
      const encodedSettings = urlParams.get(LOBE_URL_IMPORT_NAME);
      const decodedResult = shareService.decodeShareSettings(encodedSettings!);

      expect(decodedResult.data).toEqual(originalSettings);
    });

    it('should handle special characters with proper encoding', () => {
      // Note: encodeURI has limitations - it doesn't encode characters like & which can break URLs
      // This test verifies the actual behavior rather than ideal behavior
      const originalSettings: any = {
        general: { fontSize: 14 },
        customMessage: 'Hello World 你好 🎉',
      };

      // Create URL
      const url = shareService.createShareSettingsUrl(originalSettings);

      // Extract settings using URLSearchParams (the standard way)
      const urlObj = new URL(url, 'http://example.com');
      const encodedSettings = urlObj.searchParams.get(LOBE_URL_IMPORT_NAME);

      expect(encodedSettings).toBeTruthy();

      const decodedResult = shareService.decodeShareSettings(encodedSettings!);

      expect(decodedResult).toHaveProperty('data');
      expect(decodedResult.data).toEqual(originalSettings);
    });
  });

  describe('edge cases', () => {
    it('should handle very large settings object', () => {
      const largeSettings: any = {};
      for (let i = 0; i < 100; i++) {
        largeSettings[`field${i}`] = `value${i}`;
      }

      const url = shareService.createShareSettingsUrl(largeSettings);
      expect(url).toContain('settings=');
      expect(url.length).toBeGreaterThan(100);
    });

    it('should handle settings with undefined values', () => {
      const settings: any = {
        general: { fontSize: 14 },
        undefinedField: undefined,
      };

      const url = shareService.createShareSettingsUrl(settings);
      expect(url).toContain('settings=');
      // undefined values are omitted by JSON.stringify
      expect(url).not.toContain('undefined');
    });

    it('should handle circular reference prevention', () => {
      // Note: JSON.stringify will throw on circular references
      // This test verifies that the service doesn't add extra protection
      const settings: any = { general: { fontSize: 14 } };
      settings.circular = settings;

      expect(() => {
        shareService.createShareSettingsUrl(settings);
      }).toThrow();
    });

    it('should decode settings that were not created by createShareSettingsUrl', () => {
      // Simulate manually created JSON
      const manualJson = '{"language":"fr-FR","custom":"value"}';

      const result = shareService.decodeShareSettings(manualJson);

      expect(result).toHaveProperty('data');
      expect(result.data).toEqual({ language: 'fr-FR', custom: 'value' });
    });
  });
});
