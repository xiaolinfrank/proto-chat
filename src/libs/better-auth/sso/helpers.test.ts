import { describe, expect, it } from 'vitest';

import { DEFAULT_OIDC_SCOPES, buildOidcConfig, pickEnv } from './helpers';

describe('DEFAULT_OIDC_SCOPES', () => {
  it('should contain openid, email, and profile', () => {
    expect(DEFAULT_OIDC_SCOPES).toEqual(['openid', 'email', 'profile']);
  });
});

describe('pickEnv', () => {
  it('should return the first non-empty value', () => {
    expect(pickEnv('value1', 'value2')).toBe('value1');
  });

  it('should skip undefined values', () => {
    expect(pickEnv(undefined, 'value2')).toBe('value2');
  });

  it('should skip null values', () => {
    expect(pickEnv(null, 'value2')).toBe('value2');
  });

  it('should skip empty string values', () => {
    expect(pickEnv('', 'value2')).toBe('value2');
  });

  it('should skip whitespace-only strings', () => {
    expect(pickEnv('   ', 'value2')).toBe('value2');
  });

  it('should trim whitespace from the returned value', () => {
    expect(pickEnv('  hello  ')).toBe('hello');
  });

  it('should return undefined when all values are empty/null/undefined', () => {
    expect(pickEnv(undefined, null, '', '   ')).toBeUndefined();
  });

  it('should return undefined with no arguments', () => {
    expect(pickEnv()).toBeUndefined();
  });

  it('should return the first non-empty value among multiple valid options', () => {
    expect(pickEnv(undefined, null, '  ', 'first-valid', 'second-valid')).toBe('first-valid');
  });
});

describe('buildOidcConfig', () => {
  const validInput = {
    clientId: 'my-client-id',
    clientSecret: 'my-client-secret',
    issuer: 'https://example.com',
    providerId: 'my-provider',
  };

  it('should build a valid OIDC config with required fields', () => {
    const config = buildOidcConfig(validInput);

    expect(config).toMatchObject({
      clientId: 'my-client-id',
      clientSecret: 'my-client-secret',
      discoveryUrl: 'https://example.com/.well-known/openid-configuration',
      pkce: true,
      providerId: 'my-provider',
      scopes: DEFAULT_OIDC_SCOPES,
    });
  });

  it('should append /.well-known/openid-configuration to plain issuer URL', () => {
    const config = buildOidcConfig(validInput);
    expect(config.discoveryUrl).toBe('https://example.com/.well-known/openid-configuration');
  });

  it('should strip trailing slash from issuer before appending discovery path', () => {
    const config = buildOidcConfig({ ...validInput, issuer: 'https://example.com/' });
    expect(config.discoveryUrl).toBe('https://example.com/.well-known/openid-configuration');
  });

  it('should not append discovery path if issuer already contains /.well-known/', () => {
    const config = buildOidcConfig({
      ...validInput,
      issuer: 'https://example.com/.well-known/openid-configuration',
    });
    expect(config.discoveryUrl).toBe('https://example.com/.well-known/openid-configuration');
  });

  it('should strip trailing slash from issuer that already has /.well-known/ path', () => {
    const config = buildOidcConfig({
      ...validInput,
      issuer: 'https://example.com/.well-known/openid-configuration/',
    });
    expect(config.discoveryUrl).toBe('https://example.com/.well-known/openid-configuration');
  });

  it('should use default scopes when scopes are not provided', () => {
    const config = buildOidcConfig(validInput);
    expect(config.scopes).toEqual(DEFAULT_OIDC_SCOPES);
  });

  it('should use custom scopes when provided', () => {
    const config = buildOidcConfig({ ...validInput, scopes: ['openid', 'groups'] });
    expect(config.scopes).toEqual(['openid', 'groups']);
  });

  it('should enable PKCE by default', () => {
    const config = buildOidcConfig(validInput);
    expect(config.pkce).toBe(true);
  });

  it('should allow disabling PKCE', () => {
    const config = buildOidcConfig({ ...validInput, pkce: false });
    expect(config.pkce).toBe(false);
  });

  it('should apply overrides on top of base config', () => {
    const config = buildOidcConfig({
      ...validInput,
      overrides: { pkce: false, scopes: ['openid'] },
    });
    expect(config.pkce).toBe(false);
    expect(config.scopes).toEqual(['openid']);
  });

  it('should throw when clientId is missing', () => {
    expect(() => buildOidcConfig({ ...validInput, clientId: undefined })).toThrow(
      '[Better-Auth] my-provider OAuth enabled but missing credentials',
    );
  });

  it('should throw when clientSecret is missing', () => {
    expect(() => buildOidcConfig({ ...validInput, clientSecret: undefined })).toThrow(
      '[Better-Auth] my-provider OAuth enabled but missing credentials',
    );
  });

  it('should throw when issuer is missing', () => {
    expect(() => buildOidcConfig({ ...validInput, issuer: undefined })).toThrow(
      '[Better-Auth] my-provider OAuth enabled but missing credentials',
    );
  });

  it('should throw when issuer is whitespace only', () => {
    expect(() => buildOidcConfig({ ...validInput, issuer: '   ' })).toThrow(
      '[Better-Auth] my-provider OAuth enabled but missing credentials',
    );
  });

  it('should trim whitespace from issuer', () => {
    const config = buildOidcConfig({ ...validInput, issuer: '  https://example.com  ' });
    expect(config.discoveryUrl).toBe('https://example.com/.well-known/openid-configuration');
  });

  it('should include providerId in the returned config', () => {
    const config = buildOidcConfig({ ...validInput, providerId: 'custom-sso' });
    expect(config.providerId).toBe('custom-sso');
  });
});
