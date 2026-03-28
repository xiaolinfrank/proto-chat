import { describe, expect, it } from 'vitest';

import { shareService } from '../share';

describe('ShareService', () => {
  describe('createShareSettingsUrl', () => {
    it('should return a URL with encoded settings', () => {
      const settings = { general: { fontSize: 14 } };
      const result = shareService.createShareSettingsUrl(settings);

      expect(result).toContain('/?settings=');
      expect(result).toContain(encodeURI(JSON.stringify(settings)));
    });

    it('should start with /?settings=', () => {
      const result = shareService.createShareSettingsUrl({});
      expect(result.startsWith('/?settings=')).toBe(true);
    });

    it('should handle empty settings object', () => {
      const result = shareService.createShareSettingsUrl({});
      expect(result).toBe(`/?settings=${encodeURI('{}')}`);
    });

    it('should produce a URL containing a URI-encoded JSON payload', () => {
      const settings = { general: { fontSize: 16 } };
      const result = shareService.createShareSettingsUrl(settings);
      const expectedEncoded = encodeURI(JSON.stringify(settings));

      expect(result).toBe(`/?settings=${expectedEncoded}`);
    });

    it('should roundtrip with decodeShareSettings', () => {
      const settings = { general: { fontSize: 18 } };
      const url = shareService.createShareSettingsUrl(settings);

      // Extract the encoded part after "/?settings="
      const encoded = url.replace('/?settings=', '');
      const decoded = decodeURI(encoded);
      const { data } = shareService.decodeShareSettings(decoded) as { data: typeof settings };

      expect(data).toEqual(settings);
    });
  });

  describe('decodeShareSettings', () => {
    it('should parse a valid JSON string and return data', () => {
      const settings = { general: { fontSize: 14 } };
      const json = JSON.stringify(settings);

      const result = shareService.decodeShareSettings(json);

      expect(result).toEqual({ data: settings });
    });

    it('should return message on invalid JSON', () => {
      const result = shareService.decodeShareSettings('not valid json {{{');

      expect(result).toHaveProperty('message');
      expect(result).not.toHaveProperty('data');
    });

    it('should return message on empty string', () => {
      const result = shareService.decodeShareSettings('');

      expect(result).toHaveProperty('message');
      expect(result).not.toHaveProperty('data');
    });

    it('should handle a valid JSON object with nested fields', () => {
      const payload = { general: { fontSize: 16 }, tts: { sttLocale: 'en-US' } };
      const result = shareService.decodeShareSettings(JSON.stringify(payload));

      expect(result).toEqual({ data: payload });
    });

    it('should return message for truncated/malformed JSON', () => {
      const result = shareService.decodeShareSettings('{"general": {"fontSize":');

      expect(result).toHaveProperty('message');
    });

    it('should handle JSON with array values', () => {
      const payload = { tool: { builtin: [{ identifier: 'search', enabled: true }] } };
      const result = shareService.decodeShareSettings(JSON.stringify(payload));

      expect(result).toEqual({ data: payload });
    });

    it('should handle JSON with null values', () => {
      const payload = { defaultAgent: null };
      const result = shareService.decodeShareSettings(JSON.stringify(payload));

      expect(result).toEqual({ data: { defaultAgent: null } });
    });
  });
});
