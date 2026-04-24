// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/envs/auth', () => ({
  authEnv: {
    AUTH_CASDOOR_ID: 'env-client-id',
    AUTH_CASDOOR_ISSUER: 'https://env.casdoor.com',
    AUTH_CASDOOR_SECRET: 'env-client-secret',
  },
}));

import { authEnv } from '@/envs/auth';

import { CasdoorClient } from './index';

const defaultConfig = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  issuer: 'https://test.casdoor.com',
};

const mockTokenResponse = {
  access_token: 'access-token-123',
  expires_in: 3600,
  refresh_token: 'refresh-token-456',
  scope: 'openid profile email',
  token_type: 'Bearer',
};

const mockUserInfo = {
  aud: 'test-client-id',
  email: 'test@example.com',
  iss: 'https://test.casdoor.com',
  name: 'testuser',
  sub: 'user-123',
};

describe('CasdoorClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    (authEnv as any).AUTH_CASDOOR_ID = 'env-client-id';
    (authEnv as any).AUTH_CASDOOR_ISSUER = 'https://env.casdoor.com';
    (authEnv as any).AUTH_CASDOOR_SECRET = 'env-client-secret';
  });

  describe('constructor', () => {
    it('should create client with provided config', () => {
      const client = new CasdoorClient(defaultConfig);
      expect(client).toBeInstanceOf(CasdoorClient);
    });

    it('should fall back to env vars when no config provided', () => {
      const client = new CasdoorClient();
      expect(client).toBeInstanceOf(CasdoorClient);
    });

    it('should throw when issuer is missing from both config and env', () => {
      (authEnv as any).AUTH_CASDOOR_ISSUER = undefined as any;
      expect(
        () => new CasdoorClient({ clientId: 'id', clientSecret: 'secret' }),
      ).toThrow('Casdoor configuration is incomplete');
    });

    it('should throw when clientId is missing from both config and env', () => {
      (authEnv as any).AUTH_CASDOOR_ID = undefined as any;
      expect(
        () => new CasdoorClient({ issuer: 'https://test.com', clientSecret: 'secret' }),
      ).toThrow('Casdoor configuration is incomplete');
    });

    it('should throw when clientSecret is missing from both config and env', () => {
      (authEnv as any).AUTH_CASDOOR_SECRET = undefined as any;
      expect(
        () => new CasdoorClient({ issuer: 'https://test.com', clientId: 'id' }),
      ).toThrow('Casdoor configuration is incomplete');
    });

    it('should remove trailing slash from issuer', async () => {
      const client = new CasdoorClient({
        ...defaultConfig,
        issuer: 'https://test.casdoor.com/',
      });

      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockTokenResponse),
        ok: true,
      });

      await client.getToken('user', 'pass');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://test.casdoor.com/api/login/oauth/access_token',
        expect.any(Object),
      );
    });

    it('should use custom organization', async () => {
      const client = new CasdoorClient({ ...defaultConfig, organization: 'custom-org' });

      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: 'success', status: 'ok' }),
        ok: true,
      });

      await client.createUser({ email: 'a@b.com', name: 'alice', password: 'pw' });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.owner).toBe('custom-org');
    });

    it('should default organization to lobechat', async () => {
      const client = new CasdoorClient(defaultConfig);

      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: 'success', status: 'ok' }),
        ok: true,
      });

      await client.createUser({ email: 'a@b.com', name: 'alice', password: 'pw' });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.owner).toBe('lobechat');
    });
  });

  describe('getToken', () => {
    let client: CasdoorClient;

    beforeEach(() => {
      client = new CasdoorClient(defaultConfig);
    });

    it('should return token response on success', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockTokenResponse),
        ok: true,
      });

      const result = await client.getToken('testuser', 'password123');

      expect(result).toEqual(mockTokenResponse);
    });

    it('should POST to the correct endpoint', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockTokenResponse),
        ok: true,
      });

      await client.getToken('testuser', 'password123');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://test.casdoor.com/api/login/oauth/access_token',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should send correct form-encoded body', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockTokenResponse),
        ok: true,
      });

      await client.getToken('testuser', 'mypassword');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');

      const body = new URLSearchParams(options.body as string);
      expect(body.get('grant_type')).toBe('password');
      expect(body.get('username')).toBe('testuser');
      expect(body.get('password')).toBe('mypassword');
      expect(body.get('client_id')).toBe('test-client-id');
      expect(body.get('client_secret')).toBe('test-client-secret');
      expect(body.get('scope')).toBe('openid profile email');
    });

    it('should throw when response is not ok', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ error: 'invalid_grant', error_description: 'Invalid credentials' }),
        ok: false,
      });

      await expect(client.getToken('user', 'wrongpass')).rejects.toThrow('Invalid credentials');
    });

    it('should throw using error_description when available', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          error: 'invalid_grant',
          error_description: 'The provided authorization grant is invalid',
        }),
        ok: false,
      });

      await expect(client.getToken('user', 'pass')).rejects.toThrow(
        'The provided authorization grant is invalid',
      );
    });

    it('should throw using error when error_description is missing', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ error: 'server_error' }),
        ok: false,
      });

      await expect(client.getToken('user', 'pass')).rejects.toThrow('server_error');
    });

    it('should throw Authentication failed as fallback error message', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue({}),
        ok: false,
      });

      await expect(client.getToken('user', 'pass')).rejects.toThrow('Authentication failed');
    });

    it('should throw when response has error field even if ok is true', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ error: 'token_error', error_description: 'Token error' }),
        ok: true,
      });

      await expect(client.getToken('user', 'pass')).rejects.toThrow('Token error');
    });
  });

  describe('getUserInfo', () => {
    let client: CasdoorClient;

    beforeEach(() => {
      client = new CasdoorClient(defaultConfig);
    });

    it('should return user info on success', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockUserInfo),
        ok: true,
      });

      const result = await client.getUserInfo('access-token-123');

      expect(result).toEqual(mockUserInfo);
    });

    it('should GET from the correct endpoint', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockUserInfo),
        ok: true,
      });

      await client.getUserInfo('access-token-123');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://test.casdoor.com/api/userinfo',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should include Bearer token in Authorization header', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockUserInfo),
        ok: true,
      });

      await client.getUserInfo('my-access-token');

      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers.Authorization).toBe('Bearer my-access-token');
    });

    it('should throw when response is not ok', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue({}),
        ok: false,
      });

      await expect(client.getUserInfo('bad-token')).rejects.toThrow('Failed to get user info');
    });
  });

  describe('createUser', () => {
    let client: CasdoorClient;

    beforeEach(() => {
      client = new CasdoorClient(defaultConfig);
    });

    it('should create user successfully', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ data: 'Affected', msg: 'success', status: 'ok' }),
        ok: true,
      });

      await expect(
        client.createUser({ email: 'new@example.com', name: 'newuser', password: 'pw123' }),
      ).resolves.toBeUndefined();
    });

    it('should POST to the correct endpoint', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: 'success', status: 'ok' }),
        ok: true,
      });

      await client.createUser({ email: 'a@b.com', name: 'alice', password: 'pw' });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://test.casdoor.com/api/add-user',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should send Basic auth header with base64 credentials', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: 'success', status: 'ok' }),
        ok: true,
      });

      await client.createUser({ email: 'a@b.com', name: 'alice', password: 'pw' });

      const [, options] = fetchMock.mock.calls[0];
      const expectedBasic = Buffer.from('test-client-id:test-client-secret').toString('base64');
      expect(options.headers['Authorization']).toBe(`Basic ${expectedBasic}`);
    });

    it('should auto-set displayName to name when not provided', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: 'success', status: 'ok' }),
        ok: true,
      });

      await client.createUser({ email: 'a@b.com', name: 'alice', password: 'pw' });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.displayName).toBe('alice');
    });

    it('should preserve explicit displayName when provided', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: 'success', status: 'ok' }),
        ok: true,
      });

      await client.createUser({
        displayName: 'Alice Smith',
        email: 'a@b.com',
        name: 'alice',
        password: 'pw',
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.displayName).toBe('Alice Smith');
    });

    it('should default type to normal-user when not provided', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: 'success', status: 'ok' }),
        ok: true,
      });

      await client.createUser({ email: 'a@b.com', name: 'alice', password: 'pw' });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.type).toBe('normal-user');
    });

    it('should preserve explicit type when provided', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: 'success', status: 'ok' }),
        ok: true,
      });

      await client.createUser({ email: 'a@b.com', name: 'alice', password: 'pw', type: 'admin' });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.type).toBe('admin');
    });

    it('should throw with error message when API returns error status', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: 'User already exists', status: 'error' }),
        ok: true,
      });

      await expect(
        client.createUser({ email: 'a@b.com', name: 'alice', password: 'pw' }),
      ).rejects.toThrow('User already exists');
    });

    it('should throw default message when error response has no msg', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: '', status: 'error' }),
        ok: true,
      });

      await expect(
        client.createUser({ email: 'a@b.com', name: 'alice', password: 'pw' }),
      ).rejects.toThrow('Failed to create user');
    });

    it('should include owner from organization in request body', async () => {
      fetchMock.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: 'success', status: 'ok' }),
        ok: true,
      });

      await client.createUser({ email: 'a@b.com', name: 'alice', password: 'pw' });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.owner).toBe('lobechat');
      expect(body.email).toBe('a@b.com');
      expect(body.name).toBe('alice');
    });
  });

  describe('isConfigured', () => {
    it('should return true when all env vars are set', () => {
      expect(CasdoorClient.isConfigured()).toBe(true);
    });

    it('should return false when AUTH_CASDOOR_ISSUER is missing', () => {
      (authEnv as any).AUTH_CASDOOR_ISSUER = undefined as any;
      expect(CasdoorClient.isConfigured()).toBe(false);
    });

    it('should return false when AUTH_CASDOOR_ID is missing', () => {
      (authEnv as any).AUTH_CASDOOR_ID = undefined as any;
      expect(CasdoorClient.isConfigured()).toBe(false);
    });

    it('should return false when AUTH_CASDOOR_SECRET is missing', () => {
      (authEnv as any).AUTH_CASDOOR_SECRET = undefined as any;
      expect(CasdoorClient.isConfigured()).toBe(false);
    });

    it('should return false when AUTH_CASDOOR_ISSUER is empty string', () => {
      (authEnv as any).AUTH_CASDOOR_ISSUER = '' as any;
      expect(CasdoorClient.isConfigured()).toBe(false);
    });

    it('should return false when all env vars are missing', () => {
      (authEnv as any).AUTH_CASDOOR_ISSUER = undefined as any;
      (authEnv as any).AUTH_CASDOOR_ID = undefined as any;
      (authEnv as any).AUTH_CASDOOR_SECRET = undefined as any;
      expect(CasdoorClient.isConfigured()).toBe(false);
    });
  });
});
