// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSignedSessionCookies } from './cookie';

// Mock better-call module
vi.mock('better-call', () => ({
  serializeSignedCookie: vi.fn(),
}));

// Mock authEnv
vi.mock('@/envs/auth', () => ({
  authEnv: {
    AUTH_SECRET: 'test-secret-key-12345',
  },
}));

describe('createSignedSessionCookies', () => {
  const mockSessionToken = 'test-session-token-abc123';
  const mockExpiresAt = new Date('2025-12-31T23:59:59Z');

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('successful cookie creation', () => {
    it('should create secure cookie with https protocol', async () => {
      const { serializeSignedCookie } = await import('better-call');

      (serializeSignedCookie as any).mockResolvedValue(
        '__Secure-better-auth.session_token=mockSignedValue; HttpOnly; Secure; SameSite=Lax',
      );

      const cookies = await createSignedSessionCookies({
        expiresAt: mockExpiresAt,
        protocol: 'https',
        sessionToken: mockSessionToken,
      });

      expect(serializeSignedCookie).toHaveBeenCalledWith(
        '__Secure-better-auth.session_token',
        mockSessionToken,
        'test-secret-key-12345',
        {
          expires: mockExpiresAt,
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          secure: true,
        },
      );

      expect(cookies).toHaveLength(1);
      expect(cookies[0]).toContain('__Secure-better-auth.session_token');
    });

    it('should create non-secure cookie with http protocol', async () => {
      const { serializeSignedCookie } = await import('better-call');

      (serializeSignedCookie as any).mockResolvedValue(
        'better-auth.session_token=mockSignedValue; HttpOnly; SameSite=Lax',
      );

      const cookies = await createSignedSessionCookies({
        expiresAt: mockExpiresAt,
        protocol: 'http',
        sessionToken: mockSessionToken,
      });

      expect(serializeSignedCookie).toHaveBeenCalledWith(
        'better-auth.session_token',
        mockSessionToken,
        'test-secret-key-12345',
        {
          expires: mockExpiresAt,
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          secure: false,
        },
      );

      expect(cookies).toHaveLength(1);
      expect(cookies[0]).toContain('better-auth.session_token');
      expect(cookies[0]).not.toContain('__Secure-');
    });

    it('should use production environment for secure determination when protocol is null', async () => {
      vi.stubEnv('NODE_ENV', 'production');

      const { serializeSignedCookie } = await import('better-call');

      (serializeSignedCookie as any).mockResolvedValue(
        '__Secure-better-auth.session_token=mockSignedValue; HttpOnly; Secure; SameSite=Lax',
      );

      const cookies = await createSignedSessionCookies({
        expiresAt: mockExpiresAt,
        protocol: null,
        sessionToken: mockSessionToken,
      });

      expect(serializeSignedCookie).toHaveBeenCalledWith(
        '__Secure-better-auth.session_token',
        mockSessionToken,
        'test-secret-key-12345',
        expect.objectContaining({
          secure: true,
        }),
      );

      expect(cookies).toHaveLength(1);

      vi.unstubAllEnvs();
    });

    it('should use development environment for non-secure cookie when protocol is undefined', async () => {
      vi.stubEnv('NODE_ENV', 'development');

      const { serializeSignedCookie } = await import('better-call');

      (serializeSignedCookie as any).mockResolvedValue(
        'better-auth.session_token=mockSignedValue; HttpOnly; SameSite=Lax',
      );

      const cookies = await createSignedSessionCookies({
        expiresAt: mockExpiresAt,
        sessionToken: mockSessionToken,
      });

      expect(serializeSignedCookie).toHaveBeenCalledWith(
        'better-auth.session_token',
        mockSessionToken,
        'test-secret-key-12345',
        expect.objectContaining({
          secure: false,
        }),
      );

      expect(cookies).toHaveLength(1);

      vi.unstubAllEnvs();
    });

    it('should honor explicit secure flag over protocol', async () => {
      const { serializeSignedCookie } = await import('better-call');

      (serializeSignedCookie as any).mockResolvedValue(
        '__Secure-better-auth.session_token=mockSignedValue; HttpOnly; Secure; SameSite=Lax',
      );

      const cookies = await createSignedSessionCookies({
        expiresAt: mockExpiresAt,
        protocol: 'http',
        secure: true,
        sessionToken: mockSessionToken,
      });

      expect(serializeSignedCookie).toHaveBeenCalledWith(
        '__Secure-better-auth.session_token',
        mockSessionToken,
        'test-secret-key-12345',
        expect.objectContaining({
          secure: true,
        }),
      );

      expect(cookies).toHaveLength(1);
    });

    it('should set correct cookie attributes (httpOnly, path, sameSite)', async () => {
      const { serializeSignedCookie } = await import('better-call');

      (serializeSignedCookie as any).mockResolvedValue('mock-cookie-string');

      await createSignedSessionCookies({
        expiresAt: mockExpiresAt,
        protocol: 'https',
        sessionToken: mockSessionToken,
      });

      expect(serializeSignedCookie).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          expires: mockExpiresAt,
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should throw error when AUTH_SECRET is missing', async () => {
      vi.resetModules();

      // Mock authEnv with empty AUTH_SECRET
      vi.doMock('@/envs/auth', () => ({
        authEnv: {
          AUTH_SECRET: '',
        },
      }));

      const { createSignedSessionCookies: createCookiesWithNoSecret } = await import('./cookie');

      await expect(
        createCookiesWithNoSecret({
          expiresAt: mockExpiresAt,
          sessionToken: mockSessionToken,
        }),
      ).rejects.toThrow('AUTH_SECRET is required for cookie signing');
    });

    it('should throw error when AUTH_SECRET is undefined', async () => {
      vi.resetModules();

      // Mock authEnv with undefined AUTH_SECRET
      vi.doMock('@/envs/auth', () => ({
        authEnv: {
          AUTH_SECRET: undefined,
        },
      }));

      const { createSignedSessionCookies: createCookiesWithNoSecret } = await import('./cookie');

      await expect(
        createCookiesWithNoSecret({
          expiresAt: mockExpiresAt,
          sessionToken: mockSessionToken,
        }),
      ).rejects.toThrow('AUTH_SECRET is required for cookie signing');
    });
  });

  describe('edge cases', () => {
    it('should handle empty session token', async () => {
      const { serializeSignedCookie } = await import('better-call');

      (serializeSignedCookie as any).mockResolvedValue('mock-cookie-string');

      const cookies = await createSignedSessionCookies({
        expiresAt: mockExpiresAt,
        sessionToken: '',
      });

      expect(serializeSignedCookie).toHaveBeenCalledWith(
        expect.any(String),
        '',
        expect.any(String),
        expect.any(Object),
      );

      expect(cookies).toHaveLength(1);
    });

    it('should handle far future expiration date', async () => {
      const { serializeSignedCookie } = await import('better-call');

      (serializeSignedCookie as any).mockResolvedValue('mock-cookie-string');

      const farFutureDate = new Date('2099-12-31T23:59:59Z');

      await createSignedSessionCookies({
        expiresAt: farFutureDate,
        sessionToken: mockSessionToken,
      });

      expect(serializeSignedCookie).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          expires: farFutureDate,
        }),
      );
    });

    it('should handle past expiration date (immediate expiry)', async () => {
      const { serializeSignedCookie } = await import('better-call');

      (serializeSignedCookie as any).mockResolvedValue('mock-cookie-string');

      const pastDate = new Date('2020-01-01T00:00:00Z');

      await createSignedSessionCookies({
        expiresAt: pastDate,
        sessionToken: mockSessionToken,
      });

      expect(serializeSignedCookie).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          expires: pastDate,
        }),
      );
    });
  });

  describe('deprecated sessionData parameter', () => {
    it('should ignore deprecated sessionData parameter', async () => {
      const { serializeSignedCookie } = await import('better-call');

      (serializeSignedCookie as any).mockResolvedValue('mock-cookie-string');

      const mockSessionData = {
        session: {
          createdAt: new Date(),
          expiresAt: mockExpiresAt,
          id: 'session-123',
          ipAddress: '127.0.0.1',
          token: 'token-123',
          updatedAt: new Date(),
          userAgent: 'Mozilla/5.0',
          userId: 'user-123',
        },
        user: {
          avatar: 'https://example.com/avatar.jpg',
          email: 'test@example.com',
          emailVerified: true,
          fullName: 'Test User',
          id: 'user-123',
          username: 'testuser',
        },
      };

      const cookies = await createSignedSessionCookies({
        expiresAt: mockExpiresAt,
        sessionData: mockSessionData,
        sessionToken: mockSessionToken,
      });

      // Should only create one cookie for session_token, not session_data
      expect(cookies).toHaveLength(1);
      expect(serializeSignedCookie).toHaveBeenCalledTimes(1);
    });
  });
});
