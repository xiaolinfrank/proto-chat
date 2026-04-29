import { describe, expect, it, vi } from 'vitest';

import { shareService } from '../share';

vi.mock('@/const/url', () => ({
  LOBE_URL_IMPORT_NAME: 'settings',
}));

describe('ShareService', () => {
  describe('createShareSettingsUrl', () => {
    it('should create a URL with encoded settings', () => {
      const settings = { general: { fontSize: 14 } };
      const url = shareService.createShareSettingsUrl(settings);
      expect(url).toBe(`/?settings=${encodeURI(JSON.stringify(settings))}`);
    });

    it('should handle empty settings object', () => {
      const url = shareService.createShareSettingsUrl({});
      expect(url).toBe('/?settings=%7B%7D');
    });

    it('should return a valid URL format starting with /?settings=', () => {
      const url = shareService.createShareSettingsUrl({ general: { fontSize: 16 } });
      expect(url).toMatch(/^\/\?settings=/);
    });

    it('should use encodeURI preserving colons and slashes in URLs', () => {
      // encodeURI does not encode `:`, `/`, so URLs inside settings remain readable
      const settings = { general: { fontSize: 14 } } as any;
      settings.endpoint = 'https://api.example.com/v1';
      const url = shareService.createShareSettingsUrl(settings);
      expect(url).toContain('https://api.example.com/v1');
    });

    it('should encode the full settings object as JSON', () => {
      const settings = { general: { fontSize: 16, animationMode: 'agile' as const } };
      const url = shareService.createShareSettingsUrl(settings);
      const encoded = url.replace('/?settings=', '');
      const decoded = JSON.parse(decodeURI(encoded));
      expect(decoded).toEqual(settings);
    });

    it('should handle settings with nested languageModel config', () => {
      const settings = {
        languageModel: {
          openai: { fetchOnClient: true },
        },
      } as any;
      const url = shareService.createShareSettingsUrl(settings);
      const encoded = url.replace('/?settings=', '');
      const decoded = JSON.parse(decodeURI(encoded));
      expect(decoded).toEqual(settings);
    });

    it('should handle null values in settings', () => {
      const settings = { general: null } as any;
      const url = shareService.createShareSettingsUrl(settings);
      expect(url).toContain('/?settings=');
      const encoded = url.replace('/?settings=', '');
      const decoded = JSON.parse(decodeURI(encoded));
      expect(decoded).toEqual({ general: null });
    });
  });

  describe('decodeShareSettings', () => {
    it('should decode valid JSON settings string', () => {
      const settings = { general: { fontSize: 14 } };
      const encoded = JSON.stringify(settings);
      const result = shareService.decodeShareSettings(encoded);
      expect(result).toEqual({ data: settings });
    });

    it('should return error message for invalid JSON', () => {
      const result = shareService.decodeShareSettings('not-valid-json');
      expect(result).toHaveProperty('message');
      expect(result).not.toHaveProperty('data');
    });

    it('should return error message for empty string', () => {
      const result = shareService.decodeShareSettings('');
      expect(result).toHaveProperty('message');
      expect(result).not.toHaveProperty('data');
    });

    it('should decode nested settings correctly', () => {
      const settings = {
        general: { fontSize: 16, animationMode: 'elegant' as const },
      };
      const result = shareService.decodeShareSettings(JSON.stringify(settings));
      expect(result).toEqual({ data: settings });
    });

    it('should return error for malformed JSON with trailing comma', () => {
      const result = shareService.decodeShareSettings('{"key": "value",}');
      expect(result).toHaveProperty('message');
      expect(result).not.toHaveProperty('data');
    });

    it('should round-trip with createShareSettingsUrl', () => {
      const original = { general: { fontSize: 12, animationMode: 'disabled' as const } };
      const url = shareService.createShareSettingsUrl(original);
      const encodedParam = decodeURI(url.replace('/?settings=', ''));
      const result = shareService.decodeShareSettings(encodedParam);
      expect(result).toEqual({ data: original });
    });

    it('should handle JSON with special string values containing double quotes', () => {
      const raw = '{"key":"value with \\"quotes\\""}';
      const result = shareService.decodeShareSettings(raw);
      expect(result).toEqual({ data: { key: 'value with "quotes"' } });
    });

    it('should handle an array as root value', () => {
      const result = shareService.decodeShareSettings('["a","b","c"]');
      expect(result).toEqual({ data: ['a', 'b', 'c'] });
    });

    it('should handle a plain string that is valid JSON', () => {
      const result = shareService.decodeShareSettings('"just a string"');
      expect(result).toEqual({ data: 'just a string' });
    });

    it('should stringify the error in the message field', () => {
      const result = shareService.decodeShareSettings('{{invalid');
      expect(typeof result.message).toBe('string');
    });

    it('should handle JSON with unicode characters', () => {
      const raw = JSON.stringify({ key: 'こんにちは' });
      const result = shareService.decodeShareSettings(raw);
      expect(result).toEqual({ data: { key: 'こんにちは' } });
    });
  });
});
