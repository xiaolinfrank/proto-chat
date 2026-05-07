// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSignedSessionCookies } from './cookie';

const mockCookieAuthEnv = vi.hoisted(() => ({
  AUTH_SECRET: 'test-auth-secret' as string | undefined,
}));

vi.mock('@/envs/auth', () => ({
  authEnv: mockCookieAuthEnv,
}));

vi.mock('better-call', () => ({
  serializeSignedCookie: vi.fn(),
}));

const baseOptions = {
  expiresAt: new Date('2025-12-31T23:59:59Z'),
  sessionToken: 'test-session-token',
};

describe('createSignedSessionCookies', () => {
  let serializeSignedCookie: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCookieAuthEnv.AUTH_SECRET = 'test-auth-secret';

    const betterCall = await import('better-call');
    serializeSignedCookie = vi.mocked(betterCall.serializeSignedCookie);
    serializeSignedCookie.mockResolvedValue('mocked-cookie-value');
  });

  describe('secure cookie naming', () => {
    it('should use __Secure- prefix when protocol is https', async () => {
      await createSignedSessionCookies({ ...baseOptions, protocol: 'https' });

      expect(serializeSignedCookie).toHaveBeenCalledWith(
        '__Secure-better-auth.session_token',
        'test-session-token',
        'test-auth-secret',
        expect.any(Object),
      );
    });

    it('should use plain name when protocol is http', async () => {
      await createSignedSessionCookies({ ...baseOptions, protocol: 'http' });

      expect(serializeSignedCookie).toHaveBeenCalledWith(
        'better-auth.session_token',
        'test-session-token',
        'test-auth-secret',
        expect.any(Object),
      );
    });

    it('should use __Secure- prefix when secure option is explicitly true', async () => {
      await createSignedSessionCookies({ ...baseOptions, secure: true });

      expect(serializeSignedCookie).toHaveBeenCalledWith(
        '__Secure-better-auth.session_token',
        expect.any(String),
        expect.any(String),
        expect.any(Object),
      );
    });

    it('should use plain name when secure option is explicitly false', async () => {
      await createSignedSessionCookies({ ...baseOptions, secure: false });

      expect(serializeSignedCookie).toHaveBeenCalledWith(
        'better-auth.session_token',
        expect.any(String),
        expect.any(String),
        expect.any(Object),
      );
    });
  });

  describe('cookie attributes', () => {
    it('should pass secure: true when protocol is https', async () => {
      await createSignedSessionCookies({ ...baseOptions, protocol: 'https' });

      expect(serializeSignedCookie).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ secure: true }),
      );
    });

    it('should pass secure: false when protocol is http', async () => {
      await createSignedSessionCookies({ ...baseOptions, protocol: 'http' });

      expect(serializeSignedCookie).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ secure: false }),
      );
    });

    it('should always set httpOnly to true', async () => {
      await createSignedSessionCookies({ ...baseOptions, protocol: 'https' });

      expect(serializeSignedCookie).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('should always set path to /', async () => {
      await createSignedSessionCookies({ ...baseOptions, protocol: 'https' });

      expect(serializeSignedCookie).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ path: '/' }),
      );
    });

    it('should always set sameSite to lax', async () => {
      await createSignedSessionCookies({ ...baseOptions, protocol: 'https' });

      expect(serializeSignedCookie).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ sameSite: 'lax' }),
      );
    });

    it('should pass the expiresAt date as expires', async () => {
      const expiresAt = new Date('2026-06-01T00:00:00Z');
      await createSignedSessionCookies({ ...baseOptions, expiresAt, protocol: 'https' });

      expect(serializeSignedCookie).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ expires: expiresAt }),
      );
    });
  });

  describe('return value', () => {
    it('should return an array containing the serialized cookie', async () => {
      serializeSignedCookie.mockResolvedValue('__Secure-better-auth.session_token=abc; Path=/');

      const result = await createSignedSessionCookies({ ...baseOptions, protocol: 'https' });

      expect(result).toEqual(['__Secure-better-auth.session_token=abc; Path=/']);
    });

    it('should return an array with exactly one element', async () => {
      const result = await createSignedSessionCookies({ ...baseOptions, protocol: 'https' });

      expect(result).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should throw when AUTH_SECRET is not set', async () => {
      mockCookieAuthEnv.AUTH_SECRET = undefined;

      await expect(
        createSignedSessionCookies({ ...baseOptions, protocol: 'https' }),
      ).rejects.toThrow('AUTH_SECRET is required for cookie signing');
    });

    it('should not call serializeSignedCookie when AUTH_SECRET is missing', async () => {
      mockCookieAuthEnv.AUTH_SECRET = undefined;

      await expect(
        createSignedSessionCookies({ ...baseOptions, protocol: 'https' }),
      ).rejects.toThrow();

      expect(serializeSignedCookie).not.toHaveBeenCalled();
    });
  });
});
