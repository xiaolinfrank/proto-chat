import { describe, expect, it } from 'vitest';

import { BUILTIN_BETTER_AUTH_PROVIDERS, PROVIDER_ALIAS_MAP } from '@/libs/better-auth/constants';

import { isBuiltinProvider, normalizeProviderId } from './common';

describe('normalizeProviderId', () => {
  it('should return the canonical id for a known alias', () => {
    expect(normalizeProviderId('microsoft-entra-id')).toBe('microsoft');
  });

  it('should return the original provider id when no alias exists', () => {
    expect(normalizeProviderId('google')).toBe('google');
    expect(normalizeProviderId('github')).toBe('github');
    expect(normalizeProviderId('apple')).toBe('apple');
    expect(normalizeProviderId('cognito')).toBe('cognito');
    expect(normalizeProviderId('microsoft')).toBe('microsoft');
  });

  it('should return the original id for unknown providers', () => {
    expect(normalizeProviderId('unknown-provider')).toBe('unknown-provider');
    expect(normalizeProviderId('custom-oauth')).toBe('custom-oauth');
  });

  it('should return empty string unchanged', () => {
    expect(normalizeProviderId('')).toBe('');
  });

  it('should cover all entries in PROVIDER_ALIAS_MAP', () => {
    for (const [alias, canonical] of Object.entries(PROVIDER_ALIAS_MAP)) {
      expect(normalizeProviderId(alias)).toBe(canonical);
    }
  });
});

describe('isBuiltinProvider', () => {
  it('should return true for all canonical builtin provider ids', () => {
    for (const provider of BUILTIN_BETTER_AUTH_PROVIDERS) {
      expect(isBuiltinProvider(provider)).toBe(true);
    }
  });

  it('should return true for apple', () => {
    expect(isBuiltinProvider('apple')).toBe(true);
  });

  it('should return true for google', () => {
    expect(isBuiltinProvider('google')).toBe(true);
  });

  it('should return true for github', () => {
    expect(isBuiltinProvider('github')).toBe(true);
  });

  it('should return true for cognito', () => {
    expect(isBuiltinProvider('cognito')).toBe(true);
  });

  it('should return true for microsoft', () => {
    expect(isBuiltinProvider('microsoft')).toBe(true);
  });

  it('should return true for known alias microsoft-entra-id via normalization', () => {
    expect(isBuiltinProvider('microsoft-entra-id')).toBe(true);
  });

  it('should return false for unknown provider', () => {
    expect(isBuiltinProvider('unknown-provider')).toBe(false);
  });

  it('should return false for custom-oauth provider', () => {
    expect(isBuiltinProvider('custom-oauth')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isBuiltinProvider('')).toBe(false);
  });

  it('should return false for partial provider name', () => {
    expect(isBuiltinProvider('goog')).toBe(false);
    expect(isBuiltinProvider('git')).toBe(false);
  });

  it('should be case-sensitive and return false for wrong casing', () => {
    expect(isBuiltinProvider('Google')).toBe(false);
    expect(isBuiltinProvider('GITHUB')).toBe(false);
    expect(isBuiltinProvider('Apple')).toBe(false);
  });
});
