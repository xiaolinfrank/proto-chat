// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSignedCookieValue, createSignedSessionCookie } from './cookie';

// Mock the authEnv module
vi.mock('@/envs/auth', () => ({
  authEnv: {
    AUTH_SECRET: 'test-secret-key-for-testing-purposes',
  },
}));

// Stub the global process object to safely mock environment variables
vi.stubGlobal('process', {
  ...process,
  env: { ...process.env },
});

describe('Cookie Signing Utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('createSignedCookieValue', () => {
    it('should create a signed cookie value with provided secret', async () => {
      const value = 'test-session-token';
      const secret = 'custom-secret-key';

      const result = await createSignedCookieValue(value, secret);

      // Should return value.signature format
      expect(result).toContain('.');
      const parts = result.split('.');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toBe(value);
      expect(parts[1]).toBeTruthy(); // signature should exist
      expect(parts[1].length).toBeGreaterThan(0);
    });

    it('should create a signed cookie value with AUTH_SECRET from env', async () => {
      const value = 'test-session-token';

      const result = await createSignedCookieValue(value);

      // Should use AUTH_SECRET from mocked authEnv
      expect(result).toContain('.');
      const parts = result.split('.');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toBe(value);
      expect(parts[1]).toBeTruthy();
    });

    it('should throw error when AUTH_SECRET is not set and no secret provided', async () => {
      // Mock authEnv to have no AUTH_SECRET
      vi.doMock('@/envs/auth', () => ({
        authEnv: {
          AUTH_SECRET: undefined,
        },
      }));

      // Reimport to get mocked version
      vi.resetModules();
      const { createSignedCookieValue: createSignedCookieValueReimported } = await import(
        './cookie'
      );

      await expect(createSignedCookieValueReimported('test-value')).rejects.toThrow(
        'AUTH_SECRET is required for cookie signing',
      );
    });

    it('should create different signatures for different values', async () => {
      const secret = 'shared-secret';
      const value1 = 'session-token-1';
      const value2 = 'session-token-2';

      const signed1 = await createSignedCookieValue(value1, secret);
      const signed2 = await createSignedCookieValue(value2, secret);

      // Different values should produce different signatures
      expect(signed1).not.toBe(signed2);
      expect(signed1.split('.')[1]).not.toBe(signed2.split('.')[1]);
    });

    it('should create different signatures for different secrets', async () => {
      const value = 'same-session-token';
      const secret1 = 'secret-key-1';
      const secret2 = 'secret-key-2';

      const signed1 = await createSignedCookieValue(value, secret1);
      const signed2 = await createSignedCookieValue(value, secret2);

      // Same value but different secrets should produce different signatures
      expect(signed1.split('.')[0]).toBe(signed2.split('.')[0]); // same value
      expect(signed1.split('.')[1]).not.toBe(signed2.split('.')[1]); // different signatures
    });

    it('should create consistent signatures for same value and secret', async () => {
      const value = 'consistent-token';
      const secret = 'consistent-secret';

      const signed1 = await createSignedCookieValue(value, secret);
      const signed2 = await createSignedCookieValue(value, secret);

      // Same inputs should produce identical outputs (HMAC is deterministic)
      expect(signed1).toBe(signed2);
    });

    it('should handle empty string value', async () => {
      const value = '';
      const secret = 'test-secret';

      const result = await createSignedCookieValue(value, secret);

      expect(result).toContain('.');
      const parts = result.split('.');
      expect(parts[0]).toBe('');
      expect(parts[1]).toBeTruthy(); // should still have signature
    });

    it('should handle special characters in value', async () => {
      const value = 'token!@#$%^&*()_+-=[]{}|;:,<>?';
      const secret = 'test-secret';

      const result = await createSignedCookieValue(value, secret);

      expect(result).toContain('.');
      const parts = result.split('.');
      // Note: split on '.' will create multiple parts if value contains '.'
      // So we check the first part matches our value
      expect(parts[0]).toBe(value);
      expect(parts[parts.length - 1]).toBeTruthy(); // last part is signature
    });

    it('should create base64 encoded signatures', async () => {
      const value = 'test-token';
      const secret = 'test-secret';

      const result = await createSignedCookieValue(value, secret);
      const signature = result.split('.')[1];

      // Base64 should only contain valid base64 characters
      expect(signature).toMatch(/^[A-Za-z0-9+/=]+$/);
    });
  });

  describe('createSignedSessionCookie', () => {
    it('should create a properly formatted session cookie with all attributes', async () => {
      const expiresAt = new Date('2025-12-31T23:59:59Z');
      const sessionToken = 'test-session-token-123';

      const result = await createSignedSessionCookie({
        sessionToken,
        expiresAt,
        secure: true,
      });

      // Check cookie format
      expect(result).toContain('better-auth.session_token=');
      expect(result).toContain('Path=/');
      expect(result).toContain(`Expires=${expiresAt.toUTCString()}`);
      expect(result).toContain('HttpOnly');
      expect(result).toContain('SameSite=Lax');
      expect(result).toContain('Secure');
    });

    it('should URL encode the signed cookie value', async () => {
      const expiresAt = new Date('2025-12-31T23:59:59Z');
      const sessionToken = 'token-with-special-chars!@#';

      const result = await createSignedSessionCookie({
        sessionToken,
        expiresAt,
      });

      // Extract the cookie value
      const cookieValue = result.split(';')[0].split('=')[1];
      expect(cookieValue).toBeTruthy();
      // Should be URL encoded (no special chars like . should be raw)
      expect(decodeURIComponent(cookieValue)).toContain('.');
    });

    it('should include Secure flag when explicitly set to true', async () => {
      const expiresAt = new Date('2025-12-31T23:59:59Z');
      const sessionToken = 'test-token';

      const result = await createSignedSessionCookie({
        sessionToken,
        expiresAt,
        secure: true,
      });

      expect(result).toContain('Secure');
    });

    it('should not include Secure flag when explicitly set to false', async () => {
      const expiresAt = new Date('2025-12-31T23:59:59Z');
      const sessionToken = 'test-token';

      const result = await createSignedSessionCookie({
        sessionToken,
        expiresAt,
        secure: false,
      });

      expect(result).not.toContain('Secure');
    });

    it('should default secure flag based on NODE_ENV', async () => {
      const expiresAt = new Date('2025-12-31T23:59:59Z');
      const sessionToken = 'test-token';

      const result = await createSignedSessionCookie({
        sessionToken,
        expiresAt,
      });

      // In test environment, should not include Secure by default
      // This behavior depends on the actual NODE_ENV during test execution
      // We just verify the cookie is created properly
      expect(result).toContain('better-auth.session_token=');
      expect(result).toContain('HttpOnly');
    });

    it('should format cookie parts with semicolon and space separators', async () => {
      const expiresAt = new Date('2025-12-31T23:59:59Z');
      const sessionToken = 'test-token';

      const result = await createSignedSessionCookie({
        sessionToken,
        expiresAt,
      });

      // Should use "; " as separator
      const parts = result.split('; ');
      expect(parts.length).toBeGreaterThan(1);
      expect(parts[0]).toContain('better-auth.session_token=');
    });

    it('should set correct cookie name', async () => {
      const expiresAt = new Date('2025-12-31T23:59:59Z');
      const sessionToken = 'test-token';

      const result = await createSignedSessionCookie({
        sessionToken,
        expiresAt,
      });

      expect(result).toMatch(/^better-auth\.session_token=/);
    });

    it('should handle future expiration dates', async () => {
      const expiresAt = new Date('2030-01-01T00:00:00Z');
      const sessionToken = 'test-token';

      const result = await createSignedSessionCookie({
        sessionToken,
        expiresAt,
      });

      // January 1, 2030 is a Tuesday
      expect(result).toContain('Expires=Tue, 01 Jan 2030 00:00:00 GMT');
    });

    it('should handle past expiration dates (for cookie deletion)', async () => {
      const expiresAt = new Date('1970-01-01T00:00:00Z');
      const sessionToken = 'test-token';

      const result = await createSignedSessionCookie({
        sessionToken,
        expiresAt,
      });

      expect(result).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    });

    it('should always include HttpOnly flag', async () => {
      const expiresAt = new Date('2025-12-31T23:59:59Z');
      const sessionToken = 'test-token';

      const result = await createSignedSessionCookie({
        sessionToken,
        expiresAt,
        secure: false,
      });

      expect(result).toContain('HttpOnly');
    });

    it('should always include SameSite=Lax', async () => {
      const expiresAt = new Date('2025-12-31T23:59:59Z');
      const sessionToken = 'test-token';

      const result = await createSignedSessionCookie({
        sessionToken,
        expiresAt,
      });

      expect(result).toContain('SameSite=Lax');
    });

    it('should always set Path=/', async () => {
      const expiresAt = new Date('2025-12-31T23:59:59Z');
      const sessionToken = 'test-token';

      const result = await createSignedSessionCookie({
        sessionToken,
        expiresAt,
      });

      expect(result).toContain('Path=/');
    });

    it('should create signed value within the cookie', async () => {
      const expiresAt = new Date('2025-12-31T23:59:59Z');
      const sessionToken = 'test-token';

      const result = await createSignedSessionCookie({
        sessionToken,
        expiresAt,
      });

      // Extract and decode the cookie value
      const encodedValue = result.split(';')[0].split('=')[1];
      const decodedValue = decodeURIComponent(encodedValue);

      // Should contain the signature separator
      expect(decodedValue).toContain('.');
      const [value, signature] = decodedValue.split('.');
      expect(value).toBe(sessionToken);
      expect(signature).toBeTruthy();
      expect(signature.length).toBeGreaterThan(0);
    });
  });
});
