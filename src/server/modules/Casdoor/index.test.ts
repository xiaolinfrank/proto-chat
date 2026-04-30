// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CasdoorClient } from './index';

const { authEnvMock } = vi.hoisted(() => ({
  authEnvMock: {
    AUTH_CASDOOR_ID: undefined as string | undefined,
    AUTH_CASDOOR_ISSUER: undefined as string | undefined,
    AUTH_CASDOOR_SECRET: undefined as string | undefined,
  },
}));

vi.mock('@/envs/auth', () => ({
  authEnv: authEnvMock,
}));

const validConfig = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  issuer: 'https://example.casdoor.com',
};

describe('CasdoorClient', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authEnvMock.AUTH_CASDOOR_ISSUER = undefined;
    authEnvMock.AUTH_CASDOOR_ID = undefined;
    authEnvMock.AUTH_CASDOOR_SECRET = undefined;
  });

  describe('constructor', () => {
    it('should create instance with explicit config', () => {
      const client = new CasdoorClient(validConfig);
      expect(client).toBeInstanceOf(CasdoorClient);
    });

    it('should throw when issuer is missing', () => {
      expect(
        () => new CasdoorClient({ clientId: 'id', clientSecret: 'secret' }),
      ).toThrow('Casdoor configuration is incomplete');
    });

    it('should throw when clientId is missing', () => {
      expect(
        () => new CasdoorClient({ issuer: 'https://example.com', clientSecret: 'secret' }),
      ).toThrow('Casdoor configuration is incomplete');
    });

    it('should throw when clientSecret is missing', () => {
      expect(
        () => new CasdoorClient({ issuer: 'https://example.com', clientId: 'id' }),
      ).toThrow('Casdoor configuration is incomplete');
    });

    it('should fall back to env variables when config is not provided', () => {
      authEnvMock.AUTH_CASDOOR_ISSUER = 'https://env.casdoor.com';
      authEnvMock.AUTH_CASDOOR_ID = 'env-client-id';
      authEnvMock.AUTH_CASDOOR_SECRET = 'env-client-secret';

      const client = new CasdoorClient();
      expect(client).toBeInstanceOf(CasdoorClient);
    });

    it('should throw when env variables are also missing', () => {
      expect(() => new CasdoorClient()).toThrow('Casdoor configuration is incomplete');
    });

    it('should strip trailing slash from issuer', async () => {
      const client = new CasdoorClient({
        ...validConfig,
        issuer: 'https://example.casdoor.com/',
      });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok', token_type: 'Bearer', expires_in: 3600 }),
      } as Response);

      await client.getToken('user', 'pass');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://example.casdoor.com/api/login/oauth/access_token',
        expect.anything(),
      );
    });

    it('should default organization to lobechat', async () => {
      const client = new CasdoorClient(validConfig);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok', msg: 'Affected', data: 'Affected' }),
      } as Response);

      await client.createUser({ name: 'alice', email: 'a@b.com', password: 'pw' });

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.owner).toBe('lobechat');
    });

    it('should use custom organization when provided', async () => {
      const client = new CasdoorClient({ ...validConfig, organization: 'myorg' });

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok', msg: 'Affected', data: 'Affected' }),
      } as Response);

      await client.createUser({ name: 'alice', email: 'a@b.com', password: 'pw' });

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.owner).toBe('myorg');
    });
  });

  describe('getToken', () => {
    let client: CasdoorClient;

    beforeEach(() => {
      client = new CasdoorClient(validConfig);
    });

    it('should return token response on success', async () => {
      const tokenResponse = {
        access_token: 'access-123',
        expires_in: 3600,
        refresh_token: 'refresh-456',
        token_type: 'Bearer',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse,
      } as Response);

      const result = await client.getToken('testuser', 'testpass');

      expect(result).toEqual(tokenResponse);
    });

    it('should send POST to correct URL with form-encoded body', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok', token_type: 'Bearer', expires_in: 3600 }),
      } as Response);

      await client.getToken('alice', 'secret123');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://example.casdoor.com/api/login/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
      const body = new URLSearchParams(fetchCall[1]?.body as string);
      expect(body.get('username')).toBe('alice');
      expect(body.get('password')).toBe('secret123');
      expect(body.get('grant_type')).toBe('password');
      expect(body.get('client_id')).toBe('test-client-id');
      expect(body.get('client_secret')).toBe('test-client-secret');
      expect(body.get('scope')).toBe('openid profile email');
    });

    it('should throw when response has error_description', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'invalid_grant', error_description: 'Invalid credentials' }),
      } as Response);

      await expect(client.getToken('user', 'wrongpass')).rejects.toThrow('Invalid credentials');
    });

    it('should throw using error field when error_description is absent', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'invalid_client' }),
      } as Response);

      await expect(client.getToken('user', 'pass')).rejects.toThrow('invalid_client');
    });

    it('should throw generic message when no error details are present', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response);

      await expect(client.getToken('user', 'pass')).rejects.toThrow('Authentication failed');
    });
  });

  describe('getUserInfo', () => {
    let client: CasdoorClient;

    beforeEach(() => {
      client = new CasdoorClient(validConfig);
    });

    it('should return user info on success', async () => {
      const userInfo = {
        aud: 'test-client-id',
        email: 'alice@example.com',
        iss: 'https://example.casdoor.com',
        name: 'alice',
        sub: 'user-123',
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => userInfo,
      } as Response);

      const result = await client.getUserInfo('access-token-abc');

      expect(result).toEqual(userInfo);
    });

    it('should send GET with Bearer authorization header', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ aud: 'a', email: 'u@e.com', iss: 'i', name: 'u', sub: 'u1' }),
      } as Response);

      await client.getUserInfo('my-access-token');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://example.casdoor.com/api/userinfo',
        expect.objectContaining({
          headers: { Authorization: 'Bearer my-access-token' },
          method: 'GET',
        }),
      );
    });

    it('should throw when response is not ok', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
      } as Response);

      await expect(client.getUserInfo('bad-token')).rejects.toThrow('Failed to get user info');
    });
  });

  describe('createUser', () => {
    let client: CasdoorClient;

    beforeEach(() => {
      client = new CasdoorClient(validConfig);
    });

    it('should resolve successfully when status is ok', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'Affected', msg: 'Affected', status: 'ok' }),
      } as Response);

      await expect(
        client.createUser({ email: 'bob@example.com', name: 'bob', password: 'pass123' }),
      ).resolves.toBeUndefined();
    });

    it('should send POST with correct JSON body and Basic auth', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ msg: 'Affected', status: 'ok' }),
      } as Response);

      await client.createUser({ email: 'bob@example.com', name: 'bob', password: 'pass123' });

      const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
      const [url, options] = fetchCall;

      expect(url).toBe('https://example.casdoor.com/api/add-user');
      expect(options?.method).toBe('POST');

      const expectedBasic = Buffer.from('test-client-id:test-client-secret').toString('base64');
      expect((options?.headers as Record<string, string>)['Authorization']).toBe(
        `Basic ${expectedBasic}`,
      );
      expect((options?.headers as Record<string, string>)['Content-Type']).toBe('application/json');

      const body = JSON.parse(options?.body as string);
      expect(body.name).toBe('bob');
      expect(body.email).toBe('bob@example.com');
      expect(body.owner).toBe('lobechat');
      expect(body.type).toBe('normal-user');
    });

    it('should auto-set displayName to name when not provided', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ msg: 'Affected', status: 'ok' }),
      } as Response);

      await client.createUser({ email: 'c@c.com', name: 'charlie', password: 'pw' });

      const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string);
      expect(body.displayName).toBe('charlie');
    });

    it('should keep explicit displayName when provided', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ msg: 'Affected', status: 'ok' }),
      } as Response);

      await client.createUser({
        displayName: 'Charlie Brown',
        email: 'c@c.com',
        name: 'charlie',
        password: 'pw',
      });

      const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1]?.body as string);
      expect(body.displayName).toBe('Charlie Brown');
    });

    it('should throw when response status is error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ msg: 'User already exists', status: 'error' }),
      } as Response);

      await expect(
        client.createUser({ email: 'bob@example.com', name: 'bob', password: 'pass' }),
      ).rejects.toThrow('User already exists');
    });

    it('should throw generic message when status is error with no msg', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ msg: '', status: 'error' }),
      } as Response);

      await expect(
        client.createUser({ email: 'bob@example.com', name: 'bob', password: 'pass' }),
      ).rejects.toThrow('Failed to create user');
    });
  });

  describe('isConfigured', () => {
    it('should return true when all env vars are set', () => {
      authEnvMock.AUTH_CASDOOR_ISSUER = 'https://example.com';
      authEnvMock.AUTH_CASDOOR_ID = 'client-id';
      authEnvMock.AUTH_CASDOOR_SECRET = 'client-secret';

      expect(CasdoorClient.isConfigured()).toBe(true);
    });

    it('should return false when issuer is missing', () => {
      authEnvMock.AUTH_CASDOOR_ID = 'client-id';
      authEnvMock.AUTH_CASDOOR_SECRET = 'client-secret';

      expect(CasdoorClient.isConfigured()).toBe(false);
    });

    it('should return false when clientId is missing', () => {
      authEnvMock.AUTH_CASDOOR_ISSUER = 'https://example.com';
      authEnvMock.AUTH_CASDOOR_SECRET = 'client-secret';

      expect(CasdoorClient.isConfigured()).toBe(false);
    });

    it('should return false when clientSecret is missing', () => {
      authEnvMock.AUTH_CASDOOR_ISSUER = 'https://example.com';
      authEnvMock.AUTH_CASDOOR_ID = 'client-id';

      expect(CasdoorClient.isConfigured()).toBe(false);
    });

    it('should return false when all env vars are missing', () => {
      expect(CasdoorClient.isConfigured()).toBe(false);
    });
  });
});
