import { describe, expect, it } from 'vitest';

import { isBuiltinProvider, normalizeProviderId } from './common';

describe('normalizeProviderId', () => {
  it('should return canonical ID for microsoft-entra-id alias', () => {
    expect(normalizeProviderId('microsoft-entra-id')).toBe('microsoft');
  });

  it('should return the same ID when no alias exists', () => {
    expect(normalizeProviderId('google')).toBe('google');
    expect(normalizeProviderId('github')).toBe('github');
    expect(normalizeProviderId('apple')).toBe('apple');
  });

  it('should handle unknown provider IDs by returning them unchanged', () => {
    expect(normalizeProviderId('unknown-provider')).toBe('unknown-provider');
    expect(normalizeProviderId('custom-oidc')).toBe('custom-oidc');
  });

  it('should handle empty string', () => {
    expect(normalizeProviderId('')).toBe('');
  });
});

describe('isBuiltinProvider', () => {
  it('should return true for built-in providers', () => {
    expect(isBuiltinProvider('apple')).toBe(true);
    expect(isBuiltinProvider('google')).toBe(true);
    expect(isBuiltinProvider('github')).toBe(true);
    expect(isBuiltinProvider('cognito')).toBe(true);
    expect(isBuiltinProvider('microsoft')).toBe(true);
  });

  it('should return true for aliased built-in providers', () => {
    // microsoft-entra-id should be normalized to microsoft, which is built-in
    expect(isBuiltinProvider('microsoft-entra-id')).toBe(true);
  });

  it('should return false for non-built-in providers', () => {
    expect(isBuiltinProvider('auth0')).toBe(false);
    expect(isBuiltinProvider('okta')).toBe(false);
    expect(isBuiltinProvider('keycloak')).toBe(false);
    expect(isBuiltinProvider('unknown-provider')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isBuiltinProvider('')).toBe(false);
  });

  it('should be case-sensitive', () => {
    expect(isBuiltinProvider('Google')).toBe(false);
    expect(isBuiltinProvider('GITHUB')).toBe(false);
  });
});
