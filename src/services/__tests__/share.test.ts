import type { PartialDeep } from 'type-fest';

import type { UserSettings } from '@/types/user/settings';

import { describe, expect, it } from 'vitest';

import { shareService } from '../share';

describe('ShareService', () => {
  describe('createShareSettingsUrl', () => {
    it('should create a URL that starts with /?settings=', () => {
      const settings: PartialDeep<UserSettings> = {};
      const url = shareService.createShareSettingsUrl(settings);
      expect(url.startsWith('/?settings=')).toBe(true);
    });

    it('should produce a URL that decodes back to the original settings', () => {
      const settings: PartialDeep<UserSettings> = { general: { fontSize: 14 } };
      const url = shareService.createShareSettingsUrl(settings);
      const encodedPart = url.split('settings=')[1];
      const decoded = JSON.parse(decodeURIComponent(encodedPart));
      expect(decoded).toEqual(settings);
    });

    it('should handle an empty settings object', () => {
      const url = shareService.createShareSettingsUrl({});
      // encodeURI encodes { and } to %7B and %7D
      expect(url).toBe('/?settings=%7B%7D');
    });

    it('should handle settings with nested objects', () => {
      const settings: PartialDeep<UserSettings> = {
        general: { fontSize: 16 },
        tts: { sttLocale: 'en-US' },
      };
      const url = shareService.createShareSettingsUrl(settings);
      const encodedPart = url.split('settings=')[1];
      const decoded = JSON.parse(decodeURIComponent(encodedPart));
      expect(decoded).toEqual(settings);
    });

    it('should URI-encode special characters in the settings', () => {
      const settings: PartialDeep<UserSettings> = { general: { fontSize: 14 } };
      const url = shareService.createShareSettingsUrl(settings);
      // The resulting URL should not contain raw spaces
      expect(url).not.toContain(' ');
    });

  });

  describe('decodeShareSettings', () => {
    it('should return data when given valid JSON', () => {
      const settings = { general: { fontSize: 14 } };
      const result = shareService.decodeShareSettings(JSON.stringify(settings));
      expect(result).toEqual({ data: settings });
    });

    it('should return data for a simple string JSON value', () => {
      const result = shareService.decodeShareSettings('"hello"');
      expect(result).toEqual({ data: 'hello' });
    });

    it('should return data for a JSON number', () => {
      const result = shareService.decodeShareSettings('42');
      expect(result).toEqual({ data: 42 });
    });

    it('should return data for a JSON null', () => {
      const result = shareService.decodeShareSettings('null');
      expect(result).toEqual({ data: null });
    });

    it('should return data for an empty object JSON', () => {
      const result = shareService.decodeShareSettings('{}');
      expect(result).toEqual({ data: {} });
    });

    it('should return data for a nested settings object', () => {
      const input = {
        general: { fontSize: 16 },
        tts: { sttLocale: 'zh-CN' },
      };
      const result = shareService.decodeShareSettings(JSON.stringify(input));
      expect(result).toEqual({ data: input });
    });

    it('should return an error message for invalid JSON', () => {
      const result = shareService.decodeShareSettings('not valid json');
      expect(result).not.toHaveProperty('data');
      expect(result).toHaveProperty('message');
      expect(typeof (result as { message: string }).message).toBe('string');
    });

    it('should return an error message for empty string input', () => {
      const result = shareService.decodeShareSettings('');
      expect(result).not.toHaveProperty('data');
      expect(result).toHaveProperty('message');
    });

    it('should return an error message for malformed JSON with trailing comma', () => {
      const result = shareService.decodeShareSettings('{"key": "value",}');
      expect(result).not.toHaveProperty('data');
      expect(result).toHaveProperty('message');
    });

    it('should return an error message for unmatched braces', () => {
      const result = shareService.decodeShareSettings('{');
      expect(result).not.toHaveProperty('data');
      expect(result).toHaveProperty('message');
    });

    it('should round-trip with createShareSettingsUrl', () => {
      const original: PartialDeep<UserSettings> = { general: { fontSize: 14 } };
      const url = shareService.createShareSettingsUrl(original);
      const encodedParam = url.split('settings=')[1];
      const decodedParam = decodeURIComponent(encodedParam);
      const result = shareService.decodeShareSettings(decodedParam);
      expect(result).toEqual({ data: original });
    });
  });
});
