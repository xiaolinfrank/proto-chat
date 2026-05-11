import { describe, expect, it } from 'vitest';

import { BUILTIN_BETTER_AUTH_PROVIDERS, PROVIDER_ALIAS_MAP } from '../constants';
import { isBuiltinProvider, normalizeProviderId } from './common';

describe('normalizeProviderId', () => {
  it('should return the canonical id for a known alias', () => {
    expect(normalizeProviderId('microsoft-entra-id')).toBe('microsoft');
  });

  it('should return the provider as-is when no alias exists', () => {
    expect(normalizeProviderId('google')).toBe('google');
    expect(normalizeProviderId('github')).toBe('github');
    expect(normalizeProviderId('apple')).toBe('apple');
    expect(normalizeProviderId('cognito')).toBe('cognito');
  });

  it('should return unknown providers unchanged', () => {
    expect(normalizeProviderId('unknown-provider')).toBe('unknown-provider');
    expect(normalizeProviderId('custom-oauth')).toBe('custom-oauth');
    expect(normalizeProviderId('')).toBe('');
  });

  it('should cover every entry in PROVIDER_ALIAS_MAP', () => {
    for (const [alias, canonical] of Object.entries(PROVIDER_ALIAS_MAP)) {
      expect(normalizeProviderId(alias)).toBe(canonical);
    }
  });
});

describe('isBuiltinProvider', () => {
  it('should return true for each canonical builtin provider', () => {
    for (const provider of BUILTIN_BETTER_AUTH_PROVIDERS) {
      expect(isBuiltinProvider(provider)).toBe(true);
    }
  });

  it('should return true for known aliases after normalization', () => {
    expect(isBuiltinProvider('microsoft-entra-id')).toBe(true);
  });

  it('should return false for unknown providers', () => {
    expect(isBuiltinProvider('unknown-provider')).toBe(false);
    expect(isBuiltinProvider('custom-oauth')).toBe(false);
    expect(isBuiltinProvider('okta')).toBe(false);
  });

  it('should return false for an empty string', () => {
    expect(isBuiltinProvider('')).toBe(false);
  });

  it('should be case-sensitive', () => {
    expect(isBuiltinProvider('Google')).toBe(false);
    expect(isBuiltinProvider('GITHUB')).toBe(false);
  });
});
