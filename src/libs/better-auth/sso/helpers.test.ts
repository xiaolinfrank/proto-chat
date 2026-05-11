import { describe, expect, it } from 'vitest';

import { DEFAULT_OIDC_SCOPES, buildOidcConfig, pickEnv } from './helpers';

describe('pickEnv', () => {
  it('should return the first truthy, non-whitespace value', () => {
    expect(pickEnv('first', 'second')).toBe('first');
    expect(pickEnv(undefined, 'second')).toBe('second');
    expect(pickEnv(null, 'second')).toBe('second');
  });

  it('should skip empty strings and whitespace-only strings', () => {
    expect(pickEnv('', 'fallback')).toBe('fallback');
    expect(pickEnv('   ', 'fallback')).toBe('fallback');
    expect(pickEnv('\t', 'fallback')).toBe('fallback');
  });

  it('should trim the returned value', () => {
    expect(pickEnv('  trimmed  ')).toBe('trimmed');
  });

  it('should return undefined when all values are empty / falsy', () => {
    expect(pickEnv()).toBeUndefined();
    expect(pickEnv(undefined, null, '', '   ')).toBeUndefined();
  });

  it('should accept a single value', () => {
    expect(pickEnv('only')).toBe('only');
  });
});

describe('buildOidcConfig', () => {
  const validInput = {
    clientId: 'client-123',
    clientSecret: 'secret-abc',
    issuer: 'https://accounts.example.com',
    providerId: 'example',
  };

  describe('validation errors', () => {
    it('should throw when clientId is missing', () => {
      expect(() =>
        buildOidcConfig({ ...validInput, clientId: undefined }),
      ).toThrow('[Better-Auth] example OAuth enabled but missing credentials');
    });

    it('should throw when clientSecret is missing', () => {
      expect(() =>
        buildOidcConfig({ ...validInput, clientSecret: undefined }),
      ).toThrow('[Better-Auth] example OAuth enabled but missing credentials');
    });

    it('should throw when issuer is missing', () => {
      expect(() =>
        buildOidcConfig({ ...validInput, issuer: undefined }),
      ).toThrow('[Better-Auth] example OAuth enabled but missing credentials');
    });

    it('should throw when issuer is whitespace only', () => {
      expect(() =>
        buildOidcConfig({ ...validInput, issuer: '   ' }),
      ).toThrow('[Better-Auth] example OAuth enabled but missing credentials');
    });
  });

  describe('discovery URL construction', () => {
    it('should append /.well-known/openid-configuration when issuer has no well-known path', () => {
      const config = buildOidcConfig(validInput);
      expect(config.discoveryUrl).toBe(
        'https://accounts.example.com/.well-known/openid-configuration',
      );
    });

    it('should strip trailing slash from issuer before appending discovery path', () => {
      const config = buildOidcConfig({ ...validInput, issuer: 'https://accounts.example.com/' });
      expect(config.discoveryUrl).toBe(
        'https://accounts.example.com/.well-known/openid-configuration',
      );
    });

    it('should use the issuer as-is when it already contains /.well-known/', () => {
      const wellKnownUrl = 'https://accounts.example.com/.well-known/openid-configuration';
      const config = buildOidcConfig({ ...validInput, issuer: wellKnownUrl });
      expect(config.discoveryUrl).toBe(wellKnownUrl);
    });

    it('should trim whitespace from issuer before processing', () => {
      const config = buildOidcConfig({
        ...validInput,
        issuer: '  https://accounts.example.com  ',
      });
      expect(config.discoveryUrl).toBe(
        'https://accounts.example.com/.well-known/openid-configuration',
      );
    });
  });

  describe('default values', () => {
    it('should use DEFAULT_OIDC_SCOPES when scopes are not provided', () => {
      const config = buildOidcConfig(validInput);
      expect(config.scopes).toEqual(DEFAULT_OIDC_SCOPES);
    });

    it('should enable pkce by default', () => {
      const config = buildOidcConfig(validInput);
      expect(config.pkce).toBe(true);
    });

    it('should include providerId and credentials in output', () => {
      const config = buildOidcConfig(validInput);
      expect(config.providerId).toBe('example');
      expect(config.clientId).toBe('client-123');
      expect(config.clientSecret).toBe('secret-abc');
    });
  });

  describe('overrides', () => {
    it('should use custom scopes when provided', () => {
      const customScopes = ['openid', 'custom-scope'];
      const config = buildOidcConfig({ ...validInput, scopes: customScopes });
      expect(config.scopes).toEqual(customScopes);
    });

    it('should disable pkce when explicitly set to false', () => {
      const config = buildOidcConfig({ ...validInput, pkce: false });
      expect(config.pkce).toBe(false);
    });

    it('should merge overrides into the returned config', () => {
      const config = buildOidcConfig({
        ...validInput,
        overrides: { authorizationUrl: 'https://custom.example.com/auth' },
      });
      expect((config as any).authorizationUrl).toBe('https://custom.example.com/auth');
    });

    it('should allow overrides to supersede built-in fields', () => {
      const config = buildOidcConfig({
        ...validInput,
        overrides: { pkce: false },
      });
      expect(config.pkce).toBe(false);
    });
  });
});
