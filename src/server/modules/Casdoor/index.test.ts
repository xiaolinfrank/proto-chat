// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock authEnv to control environment variables in tests
vi.mock('@/envs/auth', () => ({
  authEnv: {
    AUTH_CASDOOR_ID: undefined,
    AUTH_CASDOOR_ISSUER: undefined,
    AUTH_CASDOOR_SECRET: undefined,
  },
}));

import { authEnv } from '@/envs/auth';

import { CasdoorClient } from './index';

// Helper to create a client with explicit config (bypasses env)
const createClient = (overrides?: {
  clientId?: string;
  clientSecret?: string;
  issuer?: string;
  organization?: string;
}) =>
  new CasdoorClient({
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    issuer: 'https://auth.example.com',
    organization: 'test-org',
    ...overrides,
  });

describe('CasdoorClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create client with explicit config', () => {
      expect(() => createClient()).not.toThrow();
    });

    it('should remove trailing slash from issuer', () => {
      const client = createClient({ issuer: 'https://auth.example.com/' });
      // The trailing slash should be stripped; verify by checking getToken URL
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ access_token: 'token', token_type: 'bearer', expires_in: 3600 }),
        ok: true,
      });

      return client.getToken('user', 'pass').then(() => {
        const [url] = fetchMock.mock.calls[0];
        expect(url).toBe('https://auth.example.com/api/login/oauth/access_token');
      });
    });

    it('should use default organization "lobechat" when none provided', () => {
      const client = new CasdoorClient({
        clientId: 'id',
        clientSecret: 'secret',
        issuer: 'https://auth.example.com',
      });
      // createUser uses this.organization as owner
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ status: 'ok', msg: '' }),
        ok: true,
      });

      return client
        .createUser({ email: 'u@test.com', name: 'user', password: 'pass' })
        .then(() => {
          const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
          expect(requestBody.owner).toBe('lobechat');
        });
    });

    it('should throw when issuer is missing', () => {
      expect(
        () =>
          new CasdoorClient({
            clientId: 'id',
            clientSecret: 'secret',
          }),
      ).toThrow(
        'Casdoor configuration is incomplete. Please set AUTH_CASDOOR_ISSUER, AUTH_CASDOOR_ID, and AUTH_CASDOOR_SECRET environment variables.',
      );
    });

    it('should throw when clientId is missing', () => {
      expect(
        () =>
          new CasdoorClient({
            clientSecret: 'secret',
            issuer: 'https://auth.example.com',
          }),
      ).toThrow(
        'Casdoor configuration is incomplete. Please set AUTH_CASDOOR_ISSUER, AUTH_CASDOOR_ID, and AUTH_CASDOOR_SECRET environment variables.',
      );
    });

    it('should throw when clientSecret is missing', () => {
      expect(
        () =>
          new CasdoorClient({
            clientId: 'id',
            issuer: 'https://auth.example.com',
          }),
      ).toThrow(
        'Casdoor configuration is incomplete. Please set AUTH_CASDOOR_ISSUER, AUTH_CASDOOR_ID, and AUTH_CASDOOR_SECRET environment variables.',
      );
    });

    it('should fall back to authEnv when config fields are not provided', () => {
      // Set up env mock values
      vi.mocked(authEnv).AUTH_CASDOOR_ISSUER = 'https://env-issuer.example.com';
      vi.mocked(authEnv).AUTH_CASDOOR_ID = 'env-client-id';
      vi.mocked(authEnv).AUTH_CASDOOR_SECRET = 'env-client-secret';

      expect(() => new CasdoorClient()).not.toThrow();

      // Reset
      vi.mocked(authEnv).AUTH_CASDOOR_ISSUER = undefined;
      vi.mocked(authEnv).AUTH_CASDOOR_ID = undefined;
      vi.mocked(authEnv).AUTH_CASDOOR_SECRET = undefined;
    });
  });

  describe('getToken', () => {
    it('should return token response on success', async () => {
      const expectedResponse = {
        access_token: 'abc123',
        expires_in: 7200,
        refresh_token: 'refresh456',
        scope: 'openid profile email',
        token_type: 'bearer',
      };

      fetchMock.mockResolvedValueOnce({
        json: async () => expectedResponse,
        ok: true,
      });

      const client = createClient();
      const result = await client.getToken('user@example.com', 'password123');

      expect(result).toEqual(expectedResponse);
    });

    it('should send correct request to token endpoint', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ access_token: 'tok', token_type: 'bearer', expires_in: 3600 }),
        ok: true,
      });

      const client = createClient();
      await client.getToken('myuser', 'mypassword');

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://auth.example.com/api/login/oauth/access_token');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');

      const body = new URLSearchParams(options.body);
      expect(body.get('client_id')).toBe('test-client-id');
      expect(body.get('client_secret')).toBe('test-client-secret');
      expect(body.get('grant_type')).toBe('password');
      expect(body.get('username')).toBe('myuser');
      expect(body.get('password')).toBe('mypassword');
      expect(body.get('scope')).toBe('openid profile email');
    });

    it('should throw on HTTP error response', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ error: 'invalid_client', error_description: 'Bad credentials' }),
        ok: false,
      });

      const client = createClient();
      await expect(client.getToken('user', 'wrongpass')).rejects.toThrow('Bad credentials');
    });

    it('should throw using error field when error_description is absent', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ error: 'unauthorized_client' }),
        ok: false,
      });

      const client = createClient();
      await expect(client.getToken('user', 'pass')).rejects.toThrow('unauthorized_client');
    });

    it('should throw fallback message when no error details available', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({}),
        ok: false,
      });

      const client = createClient();
      await expect(client.getToken('user', 'pass')).rejects.toThrow('Authentication failed');
    });

    it('should throw when response ok but data contains error field', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ error: 'some_error', error_description: 'Something went wrong' }),
        ok: true,
      });

      const client = createClient();
      await expect(client.getToken('user', 'pass')).rejects.toThrow('Something went wrong');
    });
  });

  describe('getUserInfo', () => {
    it('should return user info on success', async () => {
      const expectedUser = {
        aud: 'test-client-id',
        displayName: 'Test User',
        email: 'user@example.com',
        iss: 'https://auth.example.com',
        name: 'testuser',
        sub: 'user-123',
      };

      fetchMock.mockResolvedValueOnce({
        json: async () => expectedUser,
        ok: true,
      });

      const client = createClient();
      const result = await client.getUserInfo('access-token-123');

      expect(result).toEqual(expectedUser);
    });

    it('should send Authorization Bearer header', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ sub: 'u1', iss: 'iss', aud: 'aud', name: 'n', email: 'e@e.com' }),
        ok: true,
      });

      const client = createClient();
      await client.getUserInfo('my-access-token');

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://auth.example.com/api/userinfo');
      expect(options.method).toBe('GET');
      expect(options.headers['Authorization']).toBe('Bearer my-access-token');
    });

    it('should throw on HTTP error', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({}),
        ok: false,
      });

      const client = createClient();
      await expect(client.getUserInfo('bad-token')).rejects.toThrow('Failed to get user info');
    });
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ status: 'ok', msg: 'Affected', data: 'Affected' }),
        ok: true,
      });

      const client = createClient();
      await expect(
        client.createUser({ email: 'new@example.com', name: 'newuser', password: 'pass123' }),
      ).resolves.toBeUndefined();
    });

    it('should send correct request with Basic auth', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ status: 'ok', msg: '' }),
        ok: true,
      });

      const client = createClient();
      await client.createUser({ email: 'u@test.com', name: 'user', password: 'pass' });

      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('https://auth.example.com/api/add-user');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');

      const expectedAuth = `Basic ${Buffer.from('test-client-id:test-client-secret').toString('base64')}`;
      expect(options.headers['Authorization']).toBe(expectedAuth);
    });

    it('should set owner to the configured organization', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ status: 'ok', msg: '' }),
        ok: true,
      });

      const client = createClient({ organization: 'my-org' });
      await client.createUser({ email: 'u@test.com', name: 'user', password: 'pass' });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.owner).toBe('my-org');
    });

    it('should auto-set displayName to name when displayName not provided', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ status: 'ok', msg: '' }),
        ok: true,
      });

      const client = createClient();
      await client.createUser({ email: 'u@test.com', name: 'myuser', password: 'pass' });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.displayName).toBe('myuser');
    });

    it('should use provided displayName when given', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ status: 'ok', msg: '' }),
        ok: true,
      });

      const client = createClient();
      await client.createUser({
        displayName: 'Custom Name',
        email: 'u@test.com',
        name: 'myuser',
        password: 'pass',
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.displayName).toBe('Custom Name');
    });

    it('should default type to "normal-user"', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ status: 'ok', msg: '' }),
        ok: true,
      });

      const client = createClient();
      await client.createUser({ email: 'u@test.com', name: 'user', password: 'pass' });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.type).toBe('normal-user');
    });

    it('should use provided type when given', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ status: 'ok', msg: '' }),
        ok: true,
      });

      const client = createClient();
      await client.createUser({
        email: 'u@test.com',
        name: 'admin',
        password: 'pass',
        type: 'admin',
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.type).toBe('admin');
    });

    it('should throw when API returns error status', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ status: 'error', msg: 'User already exists' }),
        ok: true,
      });

      const client = createClient();
      await expect(
        client.createUser({ email: 'existing@test.com', name: 'existing', password: 'pass' }),
      ).rejects.toThrow('User already exists');
    });

    it('should throw fallback message when API error has no msg', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ status: 'error', msg: '' }),
        ok: true,
      });

      const client = createClient();
      await expect(
        client.createUser({ email: 'u@test.com', name: 'user', password: 'pass' }),
      ).rejects.toThrow('Failed to create user');
    });

    it('should pass optional fields (phone, avatar) in request body', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ status: 'ok', msg: '' }),
        ok: true,
      });

      const client = createClient();
      await client.createUser({
        avatar: 'https://example.com/avatar.png',
        email: 'u@test.com',
        name: 'user',
        password: 'pass',
        phone: '+1234567890',
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.avatar).toBe('https://example.com/avatar.png');
      expect(body.phone).toBe('+1234567890');
    });
  });

  describe('isConfigured', () => {
    it('should return false when env vars are not set', () => {
      vi.mocked(authEnv).AUTH_CASDOOR_ISSUER = undefined;
      vi.mocked(authEnv).AUTH_CASDOOR_ID = undefined;
      vi.mocked(authEnv).AUTH_CASDOOR_SECRET = undefined;

      expect(CasdoorClient.isConfigured()).toBe(false);
    });

    it('should return false when only some env vars are set', () => {
      vi.mocked(authEnv).AUTH_CASDOOR_ISSUER = 'https://auth.example.com';
      vi.mocked(authEnv).AUTH_CASDOOR_ID = undefined;
      vi.mocked(authEnv).AUTH_CASDOOR_SECRET = undefined;

      expect(CasdoorClient.isConfigured()).toBe(false);

      vi.mocked(authEnv).AUTH_CASDOOR_ISSUER = undefined;
    });

    it('should return true when all env vars are set', () => {
      vi.mocked(authEnv).AUTH_CASDOOR_ISSUER = 'https://auth.example.com';
      vi.mocked(authEnv).AUTH_CASDOOR_ID = 'client-id';
      vi.mocked(authEnv).AUTH_CASDOOR_SECRET = 'client-secret';

      expect(CasdoorClient.isConfigured()).toBe(true);

      vi.mocked(authEnv).AUTH_CASDOOR_ISSUER = undefined;
      vi.mocked(authEnv).AUTH_CASDOOR_ID = undefined;
      vi.mocked(authEnv).AUTH_CASDOOR_SECRET = undefined;
    });
  });
});
