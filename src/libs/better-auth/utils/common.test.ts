import { describe, expect, it } from 'vitest';

import { isBuiltinProvider, normalizeProviderId } from './common';

describe('normalizeProviderId', () => {
  it('should return canonical id for a known alias', () => {
    expect(normalizeProviderId('microsoft-entra-id')).toBe('microsoft');
  });

  it('should return the original id when no alias is defined', () => {
    expect(normalizeProviderId('google')).toBe('google');
  });

  it('should return the original id for an unknown provider', () => {
    expect(normalizeProviderId('some-unknown-provider')).toBe('some-unknown-provider');
  });

  it('should return the original id for empty string', () => {
    expect(normalizeProviderId('')).toBe('');
  });

  it('should not normalize built-in provider names that have no alias', () => {
    expect(normalizeProviderId('github')).toBe('github');
    expect(normalizeProviderId('apple')).toBe('apple');
    expect(normalizeProviderId('cognito')).toBe('cognito');
  });
});

describe('isBuiltinProvider', () => {
  it('should return true for known built-in providers', () => {
    expect(isBuiltinProvider('apple')).toBe(true);
    expect(isBuiltinProvider('google')).toBe(true);
    expect(isBuiltinProvider('github')).toBe(true);
    expect(isBuiltinProvider('cognito')).toBe(true);
    expect(isBuiltinProvider('microsoft')).toBe(true);
  });

  it('should return true for provider aliases that map to a built-in provider', () => {
    expect(isBuiltinProvider('microsoft-entra-id')).toBe(true);
  });

  it('should return false for unknown providers', () => {
    expect(isBuiltinProvider('okta')).toBe(false);
    expect(isBuiltinProvider('auth0')).toBe(false);
    expect(isBuiltinProvider('some-custom-provider')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isBuiltinProvider('')).toBe(false);
  });
});
