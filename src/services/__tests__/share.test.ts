import type { PartialDeep } from 'type-fest';

import type { UserSettings } from '@/types/user/settings';
import { describe, expect, it } from 'vitest';

import { shareService } from '../share';

describe('ShareService', () => {
  describe('createShareSettingsUrl', () => {
    it('should create a share URL with encoded settings', () => {
      const settings: PartialDeep<UserSettings> = { general: { fontSize: 14 } };

      const url = shareService.createShareSettingsUrl(settings);

      expect(url).toBe(`/?settings=${encodeURI(JSON.stringify(settings))}`);
    });

    it('should handle empty settings object', () => {
      const settings: PartialDeep<UserSettings> = {};

      const url = shareService.createShareSettingsUrl(settings);

      expect(url).toBe('/?settings=%7B%7D');
    });

    it('should encode settings with special characters', () => {
      const settings: PartialDeep<UserSettings> = { general: { fontSize: 14 } };

      const url = shareService.createShareSettingsUrl(settings);

      expect(url).toContain('/?settings=');
      // Verify the URL can be decoded back to original settings
      const encoded = url.replace('/?settings=', '');
      expect(JSON.parse(decodeURI(encoded))).toEqual(settings);
    });

    it('should handle nested settings objects', () => {
      const settings: PartialDeep<UserSettings> = {
        tool: { builtin: { dalle: { enable: true } } },
      };

      const url = shareService.createShareSettingsUrl(settings);

      const encoded = url.replace('/?settings=', '');
      expect(JSON.parse(decodeURI(encoded))).toEqual(settings);
    });
  });

  describe('decodeShareSettings', () => {
    it('should decode valid JSON settings string', () => {
      const settings: PartialDeep<UserSettings> = { general: { fontSize: 14 } };
      const encoded = JSON.stringify(settings);

      const result = shareService.decodeShareSettings(encoded);

      expect(result).toEqual({ data: settings });
    });

    it('should return error message for invalid JSON', () => {
      const invalidJson = 'not-valid-json{{{';

      const result = shareService.decodeShareSettings(invalidJson);

      expect(result).toHaveProperty('message');
      expect(result).not.toHaveProperty('data');
    });

    it('should handle empty string input', () => {
      const result = shareService.decodeShareSettings('');

      expect(result).toHaveProperty('message');
      expect(result).not.toHaveProperty('data');
    });

    it('should decode complex nested settings', () => {
      const settings: PartialDeep<UserSettings> = {
        tool: { builtin: { dalle: { enable: false } } },
        general: { fontSize: 16 },
      };
      const encoded = JSON.stringify(settings);

      const result = shareService.decodeShareSettings(encoded);

      expect(result).toEqual({ data: settings });
    });

    it('should return stringified error on parse failure', () => {
      const result = shareService.decodeShareSettings('{invalid}');

      expect(typeof (result as { message: string }).message).toBe('string');
    });
  });

  describe('round-trip encoding/decoding', () => {
    it('should correctly round-trip encode and decode settings', () => {
      const originalSettings: PartialDeep<UserSettings> = {
        general: { fontSize: 14 },
        tool: { builtin: { dalle: { enable: true } } },
      };

      const url = shareService.createShareSettingsUrl(originalSettings);
      const encodedParam = url.replace('/?settings=', '');
      const decoded = shareService.decodeShareSettings(decodeURI(encodedParam));

      expect(decoded).toEqual({ data: originalSettings });
    });
  });
});
