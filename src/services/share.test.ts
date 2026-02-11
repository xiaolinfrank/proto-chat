import type { PartialDeep } from 'type-fest';
import { describe, expect, it } from 'vitest';

import { LOBE_URL_IMPORT_NAME } from '@/const/url';
import type { UserSettings } from '@/types/user/settings';

import { shareService } from './share';

describe('ShareService', () => {
  describe('createShareSettingsUrl', () => {
    it('should create share URL with valid settings object', () => {
      const settings = {
        general: {
          language: 'en-US',
          themeMode: 'dark',
        },
      } as PartialDeep<UserSettings>;

      const result = shareService.createShareSettingsUrl(settings);

      expect(result).toBe(`/?${LOBE_URL_IMPORT_NAME}=${encodeURI(JSON.stringify(settings))}`);
      expect(result).toContain('settings=');
      expect(result).toContain('general');
      expect(result).toContain('language');
    });

    it('should handle empty settings object', () => {
      const settings = {};

      const result = shareService.createShareSettingsUrl(settings);

      expect(result).toBe(`/?${LOBE_URL_IMPORT_NAME}=${encodeURI(JSON.stringify(settings))}`);
      expect(result).toBe('/?settings=%7B%7D');
    });

    it('should handle nested settings structure', () => {
      const settings = {
        defaultAgent: {
          chatConfig: {
            temperature: 0.7,
          },
        },
        languageModel: {
          openai: {
            apiKey: 'test-key',
          },
        },
      } as PartialDeep<UserSettings>;

      const result = shareService.createShareSettingsUrl(settings);

      expect(result).toContain('settings=');
      expect(result).toContain('defaultAgent');
      expect(result).toContain('languageModel');
    });

    it('should handle settings with special characters', () => {
      const settings = {
        defaultAgent: {
          meta: {
            title: 'You are a helpful assistant! Do you understand? (Yes)',
            description: 'Test & demo',
          },
        },
      };

      const result = shareService.createShareSettingsUrl(settings);

      expect(result).toContain('settings=');
      expect(result).toContain('defaultAgent');
      expect(result).toContain('meta');
      // The result should be a valid URL
      expect(result).toMatch(/^\/\?settings=/);
    });

    it('should handle settings with unicode characters', () => {
      const settings = {
        general: {
          language: 'zh-CN',
        },
        defaultAgent: {
          meta: {
            description: '这是一个测试',
          },
        },
      } as PartialDeep<UserSettings>;

      const result = shareService.createShareSettingsUrl(settings);

      expect(result).toContain('settings=');
      expect(result).toContain('%');
    });

    it('should handle array values in settings', () => {
      const settings = {
        defaultAgent: {
          plugins: ['plugin1', 'plugin2'],
          meta: {
            tags: ['tag1', 'tag2', 'tag3'],
          },
        },
      };

      const result = shareService.createShareSettingsUrl(settings);

      expect(result).toContain('settings=');
      expect(result).toContain('plugins');
      expect(result).toContain('tags');
    });

    it('should handle null and undefined values', () => {
      const settings = {
        general: {
          fontSize: null,
          avatar: undefined,
          language: 'en-US',
        },
      } as any as PartialDeep<UserSettings>;

      const result = shareService.createShareSettingsUrl(settings);

      expect(result).toContain('settings=');
      expect(result).toContain('fontSize');
      expect(result).toContain('language');
    });
  });

  describe('decodeShareSettings', () => {
    it('should decode valid JSON settings string', () => {
      const settings = {
        general: {
          language: 'en-US',
          themeMode: 'dark',
        },
      };
      const encoded = JSON.stringify(settings);

      const result = shareService.decodeShareSettings(encoded);

      expect(result).toHaveProperty('data');
      expect(result.data).toEqual(settings);
      expect(result).not.toHaveProperty('message');
    });

    it('should decode nested settings structure', () => {
      const settings = {
        defaultAgent: {
          chatConfig: {
            temperature: 0.7,
          },
        },
        languageModel: {
          openai: {
            apiKey: 'test-key',
          },
        },
      };
      const encoded = JSON.stringify(settings);

      const result = shareService.decodeShareSettings(encoded);

      expect(result.data).toEqual(settings);
    });

    it('should decode empty object', () => {
      const encoded = JSON.stringify({});

      const result = shareService.decodeShareSettings(encoded);

      expect(result.data).toEqual({});
    });

    it('should handle invalid JSON string', () => {
      const invalidJson = 'not a valid json';

      const result = shareService.decodeShareSettings(invalidJson);

      expect(result).not.toHaveProperty('data');
      expect(result).toHaveProperty('message');
      expect(result.message).toBeTruthy();
    });

    it('should handle malformed JSON with missing brackets', () => {
      const malformedJson = '{"language": "en-US"';

      const result = shareService.decodeShareSettings(malformedJson);

      expect(result).not.toHaveProperty('data');
      expect(result).toHaveProperty('message');
      expect(result.message).toBeTruthy();
    });

    it('should handle empty string', () => {
      const result = shareService.decodeShareSettings('');

      expect(result).not.toHaveProperty('data');
      expect(result).toHaveProperty('message');
      expect(result.message).toBeTruthy();
    });

    it('should handle null string value', () => {
      const result = shareService.decodeShareSettings('null');

      expect(result).toHaveProperty('data');
      expect(result.data).toBeNull();
    });

    it('should handle array JSON', () => {
      const array = ['item1', 'item2', 'item3'];
      const encoded = JSON.stringify(array);

      const result = shareService.decodeShareSettings(encoded);

      expect(result.data).toEqual(array);
    });

    it('should handle settings with special characters', () => {
      const settings = {
        defaultAgent: {
          meta: {
            title: 'You are a helpful assistant! Do you understand? (Yes)',
            description: 'Test & demo',
          },
        },
      };
      const encoded = JSON.stringify(settings);

      const result = shareService.decodeShareSettings(encoded);

      expect(result.data).toEqual(settings);
    });

    it('should handle unicode characters in JSON', () => {
      const settings = {
        general: {
          language: 'zh-CN',
        },
        defaultAgent: {
          meta: {
            description: '这是一个测试',
          },
        },
      };
      const encoded = JSON.stringify(settings);

      const result = shareService.decodeShareSettings(encoded);

      expect(result.data).toEqual(settings);
    });

    it('should return error message as string when JSON.parse fails', () => {
      const invalidJson = '{invalid}';

      const result = shareService.decodeShareSettings(invalidJson);

      expect(result.message).toBeTruthy();
      expect(typeof result.message).toBe('string');
    });
  });

  describe('integration - encode and decode', () => {
    it('should encode and decode settings successfully', () => {
      const originalSettings = {
        general: {
          language: 'en-US',
          themeMode: 'dark',
        },
        defaultAgent: {
          meta: {
            avatar: 'avatar-url',
            title: 'My Agent',
          },
        },
      } as PartialDeep<UserSettings>;

      const url = shareService.createShareSettingsUrl(originalSettings);
      const searchParams = new URLSearchParams(url.split('?')[1]);
      const encodedSettings = searchParams.get(LOBE_URL_IMPORT_NAME);

      expect(encodedSettings).toBeTruthy();

      const decodedResult = shareService.decodeShareSettings(encodedSettings!);

      expect(decodedResult.data).toEqual(originalSettings);
    });

    it('should handle round-trip with special characters', () => {
      const originalSettings = {
        defaultAgent: {
          meta: {
            title: 'You are a helpful assistant! Do you understand? (Yes)',
            description: 'Test & demo',
            avatar: '🤯',
          },
        },
      };

      const url = shareService.createShareSettingsUrl(originalSettings);
      // Extract the encoded settings by decoding the URI component
      const settingsParam = url.split('settings=')[1];
      const encodedSettings = decodeURI(settingsParam);

      const decodedResult = shareService.decodeShareSettings(encodedSettings);

      expect(decodedResult.data).toEqual(originalSettings);
    });

    it('should handle round-trip with unicode characters', () => {
      const originalSettings = {
        general: {
          language: 'zh-CN',
        },
        defaultAgent: {
          meta: {
            description: '这是一个测试',
            title: '日本語 한국어',
          },
        },
      } as PartialDeep<UserSettings>;

      const url = shareService.createShareSettingsUrl(originalSettings);
      const searchParams = new URLSearchParams(url.split('?')[1]);
      const encodedSettings = searchParams.get(LOBE_URL_IMPORT_NAME);

      const decodedResult = shareService.decodeShareSettings(encodedSettings!);

      expect(decodedResult.data).toEqual(originalSettings);
    });

    it('should handle round-trip with complex nested structure', () => {
      const originalSettings = {
        defaultAgent: {
          meta: {
            avatar: 'avatar-url',
            title: 'My Agent',
          },
          chatConfig: {
            model: 'gpt-4',
            temperature: 0.7,
          },
          plugins: ['plugin1', 'plugin2'],
        },
      };

      const url = shareService.createShareSettingsUrl(originalSettings);
      const searchParams = new URLSearchParams(url.split('?')[1]);
      const encodedSettings = searchParams.get(LOBE_URL_IMPORT_NAME);

      const decodedResult = shareService.decodeShareSettings(encodedSettings!);

      expect(decodedResult.data).toEqual(originalSettings);
    });
  });
});
