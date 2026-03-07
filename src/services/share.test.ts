import { describe, expect, it } from 'vitest';

import { shareService } from './share';

describe('ShareService', () => {
  describe('createShareSettingsUrl', () => {
    it('should create a URL with the encoded settings', () => {
      const settings = { languageModel: { openai: { apiKey: 'test-key' } } };
      const url = shareService.createShareSettingsUrl(settings as any);

      expect(url).toBe(`/?settings=${encodeURI(JSON.stringify(settings))}`);
    });

    it('should handle empty settings object', () => {
      const url = shareService.createShareSettingsUrl({});

      expect(url).toBe(`/?settings=${encodeURI('{}')}`);
    });

    it('should handle nested settings', () => {
      const settings = {
        general: { language: 'zh-CN' },
        tts: { voice: { openai: { voice: 'alloy' } } },
      };
      const url = shareService.createShareSettingsUrl(settings as any);

      expect(url).toContain('/?settings=');
      expect(url).toBe(`/?settings=${encodeURI(JSON.stringify(settings))}`);
    });

    it('should produce a decodable URL', () => {
      const settings = { general: { language: 'en-US' } };
      const url = shareService.createShareSettingsUrl(settings as any);

      // Extract the encoded part after "/?settings="
      const encoded = url.slice('/?settings='.length);
      const decoded = JSON.parse(decodeURI(encoded));

      expect(decoded).toEqual(settings);
    });

    it('should handle settings with special characters in values', () => {
      const settings = { general: { customTitle: 'Hello & World / Test' } };
      const url = shareService.createShareSettingsUrl(settings as any);

      expect(url).toBe(`/?settings=${encodeURI(JSON.stringify(settings))}`);
    });

    it('should handle settings with Unicode characters', () => {
      const settings = { general: { customTitle: '你好世界' } };
      const url = shareService.createShareSettingsUrl(settings as any);

      expect(url).toBe(`/?settings=${encodeURI(JSON.stringify(settings))}`);
    });
  });

  describe('decodeShareSettings', () => {
    it('should decode valid JSON settings string', () => {
      const settings = { general: { language: 'en-US' } };
      const result = shareService.decodeShareSettings(JSON.stringify(settings));

      expect(result).toEqual({ data: settings });
    });

    it('should return data with empty object for empty JSON object string', () => {
      const result = shareService.decodeShareSettings('{}');

      expect(result).toEqual({ data: {} });
    });

    it('should return error message for invalid JSON string', () => {
      const result = shareService.decodeShareSettings('not-valid-json');

      expect(result).toHaveProperty('message');
      expect(result).not.toHaveProperty('data');
    });

    it('should return error message for malformed JSON', () => {
      const result = shareService.decodeShareSettings('{invalid:json}');

      expect(result).toHaveProperty('message');
      expect(result).not.toHaveProperty('data');
    });

    it('should return error message for empty string', () => {
      const result = shareService.decodeShareSettings('');

      expect(result).toHaveProperty('message');
      expect(result).not.toHaveProperty('data');
    });

    it('should correctly decode a round-tripped URL settings', () => {
      const original = { general: { language: 'ja-JP' }, tts: {} };
      const url = shareService.createShareSettingsUrl(original as any);

      // Extract encoded settings from URL and decode URI
      const encoded = url.slice('/?settings='.length);
      const decoded = decodeURI(encoded);
      const result = shareService.decodeShareSettings(decoded);

      expect(result).toEqual({ data: original });
    });

    it('should handle nested settings with arrays', () => {
      const settings = { languageModel: { openai: { apiKey: 'key' } } };
      const result = shareService.decodeShareSettings(JSON.stringify(settings));

      expect(result).toEqual({ data: settings });
    });
  });
});
