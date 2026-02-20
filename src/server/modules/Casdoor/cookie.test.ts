// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock better-call's serializeSignedCookie
vi.mock('better-call', () => ({
  serializeSignedCookie: vi.fn(),
}));

// Mock auth env
vi.mock('@/envs/auth', () => ({
  authEnv: {
    AUTH_SECRET: 'test-signing-secret',
  },
}));

import { serializeSignedCookie } from 'better-call';
import { createSignedSessionCookies } from './cookie';

const mockSerializeSignedCookie = vi.mocked(serializeSignedCookie);

describe('createSignedSessionCookies', () => {
  const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

  beforeEach(() => {
    vi.clearAllMocks();
    mockSerializeSignedCookie.mockResolvedValue('mock-cookie-string');
  });

  describe('secure cookie (https)', () => {
    it('should use __Secure- prefix when secure option is true', async () => {
      await createSignedSessionCookies({
        expiresAt: futureDate,
        secure: true,
        sessionToken: 'test-session-token',
      });

      expect(mockSerializeSignedCookie).toHaveBeenCalledWith(
        '__Secure-better-auth.session_token',
        'test-session-token',
        'test-signing-secret',
        expect.objectContaining({ secure: true }),
      );
    });

    it('should use __Secure- prefix when protocol is https', async () => {
      await createSignedSessionCookies({
        expiresAt: futureDate,
        protocol: 'https',
        sessionToken: 'test-session-token',
      });

      expect(mockSerializeSignedCookie).toHaveBeenCalledWith(
        '__Secure-better-auth.session_token',
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ secure: true }),
      );
    });
  });

  describe('non-secure cookie (http)', () => {
    it('should use plain name when secure option is false', async () => {
      await createSignedSessionCookies({
        expiresAt: futureDate,
        secure: false,
        sessionToken: 'test-session-token',
      });

      expect(mockSerializeSignedCookie).toHaveBeenCalledWith(
        'better-auth.session_token',
        'test-session-token',
        'test-signing-secret',
        expect.objectContaining({ secure: false }),
      );
    });

    it('should use plain name when protocol is http', async () => {
      await createSignedSessionCookies({
        expiresAt: futureDate,
        protocol: 'http',
        sessionToken: 'test-session-token',
      });

      expect(mockSerializeSignedCookie).toHaveBeenCalledWith(
        'better-auth.session_token',
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ secure: false }),
      );
    });
  });

  describe('return value', () => {
    it('should return an array with the serialized cookie', async () => {
      mockSerializeSignedCookie.mockResolvedValue('Set-Cookie: better-auth.session_token=signed; Path=/');

      const result = await createSignedSessionCookies({
        expiresAt: futureDate,
        secure: false,
        sessionToken: 'my-token',
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe('Set-Cookie: better-auth.session_token=signed; Path=/');
    });
  });

  describe('cookie options', () => {
    it('should pass correct cookie options to serializeSignedCookie', async () => {
      await createSignedSessionCookies({
        expiresAt: futureDate,
        secure: false,
        sessionToken: 'token',
      });

      expect(mockSerializeSignedCookie).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          expires: futureDate,
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
        }),
      );
    });

    it('should pass the session token as the cookie value', async () => {
      const token = 'unique-session-token-xyz';

      await createSignedSessionCookies({
        expiresAt: futureDate,
        secure: false,
        sessionToken: token,
      });

      expect(mockSerializeSignedCookie).toHaveBeenCalledWith(
        expect.any(String),
        token,
        expect.any(String),
        expect.anything(),
      );
    });

    it('should pass AUTH_SECRET as the signing secret', async () => {
      await createSignedSessionCookies({
        expiresAt: futureDate,
        secure: false,
        sessionToken: 'token',
      });

      expect(mockSerializeSignedCookie).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'test-signing-secret',
        expect.anything(),
      );
    });
  });

  describe('protocol-based security detection', () => {
    it('should infer secure=true from https protocol', async () => {
      await createSignedSessionCookies({
        expiresAt: futureDate,
        protocol: 'https',
        sessionToken: 'token',
      });

      const cookieName = mockSerializeSignedCookie.mock.calls[0][0] as string;
      expect(cookieName).toBe('__Secure-better-auth.session_token');
    });

    it('should infer secure=false from http protocol', async () => {
      await createSignedSessionCookies({
        expiresAt: futureDate,
        protocol: 'http',
        sessionToken: 'token',
      });

      const cookieName = mockSerializeSignedCookie.mock.calls[0][0] as string;
      expect(cookieName).toBe('better-auth.session_token');
    });

    it('should override protocol-derived security with explicit secure option', async () => {
      // explicit secure=true takes precedence even over no protocol
      await createSignedSessionCookies({
        expiresAt: futureDate,
        secure: true,
        sessionToken: 'token',
      });

      const cookieName = mockSerializeSignedCookie.mock.calls[0][0] as string;
      expect(cookieName).toBe('__Secure-better-auth.session_token');
    });
  });

  describe('error handling', () => {
    it('should throw when AUTH_SECRET is not set', async () => {
      const { authEnv } = await import('@/envs/auth');
      const originalSecret = authEnv.AUTH_SECRET;

      // Temporarily remove the secret
      (authEnv as Record<string, unknown>).AUTH_SECRET = undefined;

      await expect(
        createSignedSessionCookies({
          expiresAt: futureDate,
          secure: false,
          sessionToken: 'token',
        }),
      ).rejects.toThrow('AUTH_SECRET is required for cookie signing');

      // Restore
      (authEnv as Record<string, unknown>).AUTH_SECRET = originalSecret;
    });
  });
});
