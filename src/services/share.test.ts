import { describe, expect, it, vi } from 'vitest';

vi.mock('@/const/url', () => ({
  LOBE_URL_IMPORT_NAME: 'settings',
}));

import { shareService } from './share';

describe('ShareService', () => {
  describe('createShareSettingsUrl', () => {
    it('should create a URL with encoded settings', () => {
      const settings = { general: { fontSize: 14 } };
      const result = shareService.createShareSettingsUrl(settings);
      expect(result).toBe(`/?settings=${encodeURI(JSON.stringify(settings))}`);
    });

    it('should handle an empty settings object', () => {
      const result = shareService.createShareSettingsUrl({});
      expect(result).toBe('/?settings=%7B%7D');
    });

    it('should encode settings with special characters in nested values', () => {
      const settings = { general: { fontSize: 14 } };
      const result = shareService.createShareSettingsUrl(settings);
      expect(result).toContain('/?settings=');
      // Verify the encoded URL can be decoded back to the original settings
      const encoded = result.replace('/?settings=', '');
      expect(JSON.parse(decodeURI(encoded))).toEqual(settings);
    });

    it('should handle nested settings objects', () => {
      const settings = {
        general: { fontSize: 16, animationMode: 'agile' as const },
      };
      const result = shareService.createShareSettingsUrl(settings);
      const encoded = result.replace('/?settings=', '');
      expect(JSON.parse(decodeURI(encoded))).toEqual(settings);
    });

    it('should handle settings with array values', () => {
      const settings = {
        defaultAgent: { config: { plugins: ['plugin1', 'plugin2'] } } as any,
      };
      const result = shareService.createShareSettingsUrl(settings);
      const encoded = result.replace('/?settings=', '');
      expect(JSON.parse(decodeURI(encoded))).toEqual(settings);
    });

    it('should produce a URL starting with /?settings=', () => {
      const result = shareService.createShareSettingsUrl({ general: { fontSize: 12 } });
      expect(result).toMatch(/^\/\?settings=/);
    });
  });

  describe('decodeShareSettings', () => {
    it('should decode valid JSON settings string', () => {
      const settings = { general: { fontSize: 14 } };
      const encoded = JSON.stringify(settings);
      const result = shareService.decodeShareSettings(encoded);
      expect(result).toEqual({ data: settings });
    });

    it('should return data for an empty object JSON string', () => {
      const result = shareService.decodeShareSettings('{}');
      expect(result).toEqual({ data: {} });
    });

    it('should return error message for invalid JSON', () => {
      const result = shareService.decodeShareSettings('not-valid-json');
      expect(result).toHaveProperty('message');
      expect(result).not.toHaveProperty('data');
    });

    it('should return error message for empty string', () => {
      const result = shareService.decodeShareSettings('');
      expect(result).toHaveProperty('message');
    });

    it('should return error message for malformed JSON', () => {
      const result = shareService.decodeShareSettings('{invalid: json}');
      expect(result).toHaveProperty('message');
      expect((result as { message: string }).message).toBeTruthy();
    });

    it('should decode complex nested settings', () => {
      const settings = {
        general: { fontSize: 14, animationMode: 'disabled' as const },
        defaultAgent: { config: { model: 'gpt-4' } as any },
      };
      const result = shareService.decodeShareSettings(JSON.stringify(settings));
      expect(result).toEqual({ data: settings });
    });

    it('should decode settings created by createShareSettingsUrl', () => {
      const originalSettings = { general: { fontSize: 14 } };
      const url = shareService.createShareSettingsUrl(originalSettings);
      const encoded = decodeURI(url.replace('/?settings=', ''));
      const result = shareService.decodeShareSettings(encoded);
      expect(result).toEqual({ data: originalSettings });
    });

    it('should handle JSON with unicode characters', () => {
      const settings = { general: { fontSize: 14 } };
      const result = shareService.decodeShareSettings(JSON.stringify(settings));
      expect(result).toEqual({ data: settings });
    });

    it('should return a message string when JSON parse fails', () => {
      const result = shareService.decodeShareSettings('undefined');
      const typedResult = result as { message: string };
      expect(typeof typedResult.message).toBe('string');
    });
  });
});
