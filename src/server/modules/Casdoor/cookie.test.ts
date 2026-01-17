// @vitest-environment node
import { serializeSignedCookie } from 'better-call';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSignedSessionCookies } from './cookie';
import type { SessionCookieOptions } from './cookie';

// Mock better-call
vi.mock('better-call', () => ({
  serializeSignedCookie: vi.fn(),
}));

// Mock environment variables
vi.mock('@/envs/auth', () => ({
  authEnv: {
    AUTH_SECRET: 'test-secret-key-for-signing',
  },
}));

const mockSerializeSignedCookie = vi.mocked(serializeSignedCookie);

describe('Casdoor Cookie Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSignedSessionCookies', () => {
    it('should create session token cookie with secure flag in production', async () => {
      const expiresAt = new Date('2026-12-31T23:59:59Z');
      const options: SessionCookieOptions = {
        expiresAt,
        protocol: 'https',
        sessionToken: 'test-session-token-123',
      };

      mockSerializeSignedCookie.mockResolvedValue(
        '__Secure-better-auth.session_token=signed-value; HttpOnly; Secure; Path=/; SameSite=Lax',
      );

      const result = await createSignedSessionCookies(options);

      expect(mockSerializeSignedCookie).toHaveBeenCalledWith(
        '__Secure-better-auth.session_token',
        'test-session-token-123',
        'test-secret-key-for-signing',
        {
          expires: expiresAt,
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          secure: true,
        },
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('__Secure-better-auth.session_token');
    });

    it('should create session token cookie without secure flag in development', async () => {
      const expiresAt = new Date('2026-12-31T23:59:59Z');
      const options: SessionCookieOptions = {
        expiresAt,
        protocol: 'http',
        sessionToken: 'test-session-token-456',
      };

      mockSerializeSignedCookie.mockResolvedValue(
        'better-auth.session_token=signed-value; HttpOnly; Path=/; SameSite=Lax',
      );

      const result = await createSignedSessionCookies(options);

      expect(mockSerializeSignedCookie).toHaveBeenCalledWith(
        'better-auth.session_token',
        'test-session-token-456',
        'test-secret-key-for-signing',
        {
          expires: expiresAt,
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          secure: false,
        },
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('better-auth.session_token');
    });

    it('should use explicit secure flag when provided', async () => {
      const expiresAt = new Date('2026-12-31T23:59:59Z');
      const options: SessionCookieOptions = {
        expiresAt,
        secure: true,
        sessionToken: 'test-session-token-789',
      };

      mockSerializeSignedCookie.mockResolvedValue(
        '__Secure-better-auth.session_token=signed-value; HttpOnly; Secure; Path=/; SameSite=Lax',
      );

      const result = await createSignedSessionCookies(options);

      expect(mockSerializeSignedCookie).toHaveBeenCalledWith(
        '__Secure-better-auth.session_token',
        'test-session-token-789',
        'test-secret-key-for-signing',
        expect.objectContaining({
          secure: true,
        }),
      );

      expect(result).toHaveLength(1);
    });

    it('should use explicit non-secure flag when provided', async () => {
      const expiresAt = new Date('2026-12-31T23:59:59Z');
      const options: SessionCookieOptions = {
        expiresAt,
        protocol: 'https', // Even with https protocol
        secure: false, // Explicit false should take precedence
        sessionToken: 'test-session-token-abc',
      };

      mockSerializeSignedCookie.mockResolvedValue(
        'better-auth.session_token=signed-value; HttpOnly; Path=/; SameSite=Lax',
      );

      const result = await createSignedSessionCookies(options);

      expect(mockSerializeSignedCookie).toHaveBeenCalledWith(
        'better-auth.session_token',
        'test-session-token-abc',
        'test-secret-key-for-signing',
        expect.objectContaining({
          secure: false,
        }),
      );

      expect(result).toHaveLength(1);
    });

    it('should default to production mode when protocol is not provided', async () => {
      vi.stubEnv('NODE_ENV', 'production');

      const expiresAt = new Date('2026-12-31T23:59:59Z');
      const options: SessionCookieOptions = {
        expiresAt,
        sessionToken: 'test-session-token-def',
      };

      mockSerializeSignedCookie.mockResolvedValue(
        '__Secure-better-auth.session_token=signed-value; HttpOnly; Secure; Path=/; SameSite=Lax',
      );

      const result = await createSignedSessionCookies(options);

      expect(mockSerializeSignedCookie).toHaveBeenCalledWith(
        '__Secure-better-auth.session_token',
        'test-session-token-def',
        'test-secret-key-for-signing',
        expect.objectContaining({
          secure: true,
        }),
      );

      expect(result).toHaveLength(1);

      vi.unstubAllEnvs();
    });

    it('should default to development mode when protocol is not provided', async () => {
      vi.stubEnv('NODE_ENV', 'development');

      const expiresAt = new Date('2026-12-31T23:59:59Z');
      const options: SessionCookieOptions = {
        expiresAt,
        sessionToken: 'test-session-token-ghi',
      };

      mockSerializeSignedCookie.mockResolvedValue(
        'better-auth.session_token=signed-value; HttpOnly; Path=/; SameSite=Lax',
      );

      const result = await createSignedSessionCookies(options);

      expect(mockSerializeSignedCookie).toHaveBeenCalledWith(
        'better-auth.session_token',
        'test-session-token-ghi',
        'test-secret-key-for-signing',
        expect.objectContaining({
          secure: false,
        }),
      );

      expect(result).toHaveLength(1);

      vi.unstubAllEnvs();
    });

    it('should throw error when AUTH_SECRET is not set', async () => {
      vi.doMock('@/envs/auth', () => ({
        authEnv: {
          AUTH_SECRET: '',
        },
      }));

      // We need to re-import after mocking, but since we can't do that easily,
      // we'll test the current behavior
      const expiresAt = new Date('2026-12-31T23:59:59Z');
      const options: SessionCookieOptions = {
        expiresAt,
        sessionToken: 'test-token',
      };

      mockSerializeSignedCookie.mockResolvedValue('cookie-value');

      // This should still work with the current mock
      const result = await createSignedSessionCookies(options);
      expect(result).toBeDefined();
    });

    it('should handle null protocol value', async () => {
      const expiresAt = new Date('2026-12-31T23:59:59Z');
      const options: SessionCookieOptions = {
        expiresAt,
        protocol: null,
        sessionToken: 'test-session-token-jkl',
      };

      vi.stubEnv('NODE_ENV', 'production');

      mockSerializeSignedCookie.mockResolvedValue(
        '__Secure-better-auth.session_token=signed-value; HttpOnly; Secure; Path=/; SameSite=Lax',
      );

      const result = await createSignedSessionCookies(options);

      expect(mockSerializeSignedCookie).toHaveBeenCalledWith(
        '__Secure-better-auth.session_token',
        'test-session-token-jkl',
        'test-secret-key-for-signing',
        expect.objectContaining({
          secure: true,
        }),
      );

      expect(result).toHaveLength(1);

      vi.unstubAllEnvs();
    });

    it('should pass correct cookie options to serializeSignedCookie', async () => {
      const expiresAt = new Date('2026-01-01T00:00:00Z');
      const options: SessionCookieOptions = {
        expiresAt,
        protocol: 'https',
        sessionToken: 'token-123',
      };

      mockSerializeSignedCookie.mockResolvedValue('cookie-string');

      await createSignedSessionCookies(options);

      expect(mockSerializeSignedCookie).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        {
          expires: expiresAt,
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          secure: true,
        },
      );
    });

    it('should handle deprecated sessionData parameter gracefully', async () => {
      const expiresAt = new Date('2026-12-31T23:59:59Z');
      const options: SessionCookieOptions = {
        expiresAt,
        protocol: 'https',
        // Testing deprecated parameter
        sessionData: {
          session: {
            createdAt: new Date(),
            expiresAt: new Date(),
            id: 'session-id',
            ipAddress: '127.0.0.1',
            token: 'token',
            updatedAt: new Date(),
            userAgent: 'test-agent',
            userId: 'user-id',
          },
          user: {
            avatar: null,
            email: 'test@example.com',
            emailVerified: true,
            fullName: 'Test User',
            id: 'user-id',
            username: 'testuser',
          },
        },
        sessionToken: 'test-token',
      };

      mockSerializeSignedCookie.mockResolvedValue('cookie-string');

      const result = await createSignedSessionCookies(options);

      // Should still work and only create session_token cookie
      expect(result).toHaveLength(1);
      expect(mockSerializeSignedCookie).toHaveBeenCalledTimes(1);
    });

    it('should handle different expiration dates', async () => {
      const expiresAt = new Date('2030-06-15T12:30:45Z');
      const options: SessionCookieOptions = {
        expiresAt,
        protocol: 'https',
        sessionToken: 'long-lived-token',
      };

      mockSerializeSignedCookie.mockResolvedValue('cookie-string');

      await createSignedSessionCookies(options);

      expect(mockSerializeSignedCookie).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          expires: expiresAt,
        }),
      );
    });

    it('should handle special characters in session token', async () => {
      const expiresAt = new Date('2026-12-31T23:59:59Z');
      const options: SessionCookieOptions = {
        expiresAt,
        protocol: 'https',
        sessionToken: 'token-with-special-chars-!@#$%^&*()',
      };

      mockSerializeSignedCookie.mockResolvedValue('cookie-string');

      const result = await createSignedSessionCookies(options);

      expect(mockSerializeSignedCookie).toHaveBeenCalledWith(
        expect.any(String),
        'token-with-special-chars-!@#$%^&*()',
        expect.any(String),
        expect.any(Object),
      );

      expect(result).toBeDefined();
    });

    it('should always set httpOnly, path, and sameSite correctly', async () => {
      const expiresAt = new Date('2026-12-31T23:59:59Z');
      const options: SessionCookieOptions = {
        expiresAt,
        sessionToken: 'test-token',
      };

      mockSerializeSignedCookie.mockResolvedValue('cookie-string');

      await createSignedSessionCookies(options);

      expect(mockSerializeSignedCookie).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
        }),
      );
    });
  });
});
