import { describe, expect, it } from 'vitest';

import { isBuiltinProvider, normalizeProviderId } from './common';

describe('common', () => {
  describe('normalizeProviderId', () => {
    it('should return the same provider id when no alias exists', () => {
      expect(normalizeProviderId('google')).toBe('google');
    });

    it('should normalize microsoft-entra-id to microsoft', () => {
      expect(normalizeProviderId('microsoft-entra-id')).toBe('microsoft');
    });

    it('should return unknown providers unchanged', () => {
      expect(normalizeProviderId('unknown-provider')).toBe('unknown-provider');
    });

    it('should handle empty string', () => {
      expect(normalizeProviderId('')).toBe('');
    });

    it('should not normalize providers that are already canonical', () => {
      expect(normalizeProviderId('microsoft')).toBe('microsoft');
    });
  });

  describe('isBuiltinProvider', () => {
    it('should return true for google', () => {
      expect(isBuiltinProvider('google')).toBe(true);
    });

    it('should return true for github', () => {
      expect(isBuiltinProvider('github')).toBe(true);
    });

    it('should return true for apple', () => {
      expect(isBuiltinProvider('apple')).toBe(true);
    });

    it('should return true for microsoft', () => {
      expect(isBuiltinProvider('microsoft')).toBe(true);
    });

    it('should return true for cognito', () => {
      expect(isBuiltinProvider('cognito')).toBe(true);
    });

    it('should return true for microsoft-entra-id via alias normalization', () => {
      expect(isBuiltinProvider('microsoft-entra-id')).toBe(true);
    });

    it('should return false for a custom/unknown provider', () => {
      expect(isBuiltinProvider('my-custom-provider')).toBe(false);
    });

    it('should return false for an empty string', () => {
      expect(isBuiltinProvider('')).toBe(false);
    });

    it('should return false for generic-oidc (not a builtin)', () => {
      expect(isBuiltinProvider('generic-oidc')).toBe(false);
    });

    it('should return false for okta (not a builtin)', () => {
      expect(isBuiltinProvider('okta')).toBe(false);
    });
  });
});
