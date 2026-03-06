import { describe, expect, it } from 'vitest';

import { DEFAULT_OIDC_SCOPES, buildOidcConfig, pickEnv } from './helpers';

describe('helpers', () => {
  describe('DEFAULT_OIDC_SCOPES', () => {
    it('should contain openid, email, and profile', () => {
      expect(DEFAULT_OIDC_SCOPES).toEqual(['openid', 'email', 'profile']);
    });
  });

  describe('pickEnv', () => {
    it('should return the first non-empty value', () => {
      expect(pickEnv('hello', 'world')).toBe('hello');
    });

    it('should skip undefined values and return next truthy value', () => {
      expect(pickEnv(undefined, 'fallback')).toBe('fallback');
    });

    it('should skip null values and return next truthy value', () => {
      expect(pickEnv(null, 'fallback')).toBe('fallback');
    });

    it('should skip empty string values and return next truthy value', () => {
      expect(pickEnv('', 'fallback')).toBe('fallback');
    });

    it('should skip whitespace-only strings and return next truthy value', () => {
      expect(pickEnv('   ', 'fallback')).toBe('fallback');
    });

    it('should return undefined when all values are empty/null/undefined', () => {
      expect(pickEnv(undefined, null, '', '   ')).toBeUndefined();
    });

    it('should return undefined when called with no arguments', () => {
      expect(pickEnv()).toBeUndefined();
    });

    it('should trim the returned value', () => {
      expect(pickEnv('  trimmed  ')).toBe('trimmed');
    });

    it('should return the first truthy value among multiple candidates', () => {
      expect(pickEnv(undefined, null, '', 'first', 'second')).toBe('first');
    });
  });

  describe('buildOidcConfig', () => {
    const baseInput = {
      clientId: 'my-client-id',
      clientSecret: 'my-client-secret',
      issuer: 'https://auth.example.com',
      providerId: 'my-provider',
    };

    it('should return a valid config with required fields', () => {
      const result = buildOidcConfig(baseInput);

      expect(result).toMatchObject({
        clientId: 'my-client-id',
        clientSecret: 'my-client-secret',
        providerId: 'my-provider',
        pkce: true,
        scopes: DEFAULT_OIDC_SCOPES,
      });
    });

    it('should generate discoveryUrl by appending /.well-known/openid-configuration', () => {
      const result = buildOidcConfig(baseInput);

      expect(result.discoveryUrl).toBe(
        'https://auth.example.com/.well-known/openid-configuration',
      );
    });

    it('should not double-append discovery path if issuer already contains it', () => {
      const result = buildOidcConfig({
        ...baseInput,
        issuer: 'https://auth.example.com/.well-known/openid-configuration',
      });

      expect(result.discoveryUrl).toBe(
        'https://auth.example.com/.well-known/openid-configuration',
      );
    });

    it('should strip trailing slash from issuer before generating discoveryUrl', () => {
      const result = buildOidcConfig({
        ...baseInput,
        issuer: 'https://auth.example.com/',
      });

      expect(result.discoveryUrl).toBe(
        'https://auth.example.com/.well-known/openid-configuration',
      );
    });

    it('should use custom scopes when provided', () => {
      const result = buildOidcConfig({
        ...baseInput,
        scopes: ['openid', 'custom-scope'],
      });

      expect(result.scopes).toEqual(['openid', 'custom-scope']);
    });

    it('should default pkce to true', () => {
      const result = buildOidcConfig(baseInput);

      expect(result.pkce).toBe(true);
    });

    it('should allow overriding pkce to false', () => {
      const result = buildOidcConfig({ ...baseInput, pkce: false });

      expect(result.pkce).toBe(false);
    });

    it('should apply overrides on top of base config', () => {
      const result = buildOidcConfig({
        ...baseInput,
        overrides: { pkce: false, scopes: ['openid'] },
      });

      expect(result.pkce).toBe(false);
      expect(result.scopes).toEqual(['openid']);
    });

    it('should throw when clientId is missing', () => {
      expect(() =>
        buildOidcConfig({ ...baseInput, clientId: undefined }),
      ).toThrow('[Better-Auth] my-provider OAuth enabled but missing credentials');
    });

    it('should throw when clientSecret is missing', () => {
      expect(() =>
        buildOidcConfig({ ...baseInput, clientSecret: undefined }),
      ).toThrow('[Better-Auth] my-provider OAuth enabled but missing credentials');
    });

    it('should throw when issuer is missing', () => {
      expect(() =>
        buildOidcConfig({ ...baseInput, issuer: undefined }),
      ).toThrow('[Better-Auth] my-provider OAuth enabled but missing credentials');
    });

    it('should throw when issuer is whitespace only', () => {
      expect(() =>
        buildOidcConfig({ ...baseInput, issuer: '   ' }),
      ).toThrow('[Better-Auth] my-provider OAuth enabled but missing credentials');
    });
  });
});
