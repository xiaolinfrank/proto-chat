// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CasdoorClient } from './index';

// vi.hoisted ensures the object is created before vi.mock factories run
const mockAuthEnvValues = vi.hoisted(() => ({
  AUTH_CASDOOR_ID: 'test-client-id' as string | undefined,
  AUTH_CASDOOR_ISSUER: 'https://casdoor.example.com' as string | undefined,
  AUTH_CASDOOR_SECRET: 'test-client-secret' as string | undefined,
}));

vi.mock('@/envs/auth', () => ({
  authEnv: mockAuthEnvValues,
}));

const defaultConfig = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  issuer: 'https://casdoor.example.com',
};

describe('CasdoorClient', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore authEnv mock values to defaults
    mockAuthEnvValues.AUTH_CASDOOR_ISSUER = 'https://casdoor.example.com';
    mockAuthEnvValues.AUTH_CASDOOR_ID = 'test-client-id';
    mockAuthEnvValues.AUTH_CASDOOR_SECRET = 'test-client-secret';
    // Fresh fetch mock for each test
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    // @ts-expect-error
    global.fetch = undefined;
  });

  describe('constructor', () => {
    it('should create instance with provided config', () => {
      const client = new CasdoorClient(defaultConfig);
      expect(client).toBeDefined();
    });

    it('should remove trailing slash from issuer', () => {
      const client = new CasdoorClient({
        ...defaultConfig,
        issuer: 'https://casdoor.example.com/',
      });
      expect(client['issuer']).toBe('https://casdoor.example.com');
    });

    it('should use default organization when not provided', () => {
      const client = new CasdoorClient(defaultConfig);
      expect(client['organization']).toBe('lobechat');
    });

    it('should use custom organization when provided', () => {
      const client = new CasdoorClient({ ...defaultConfig, organization: 'my-org' });
      expect(client['organization']).toBe('my-org');
    });

    it('should fall back to authEnv values when config is not provided', () => {
      const client = new CasdoorClient();
      expect(client['issuer']).toBe('https://casdoor.example.com');
      expect(client['clientId']).toBe('test-client-id');
      expect(client['clientSecret']).toBe('test-client-secret');
    });

    it('should throw when issuer is missing from config and env', () => {
      mockAuthEnvValues.AUTH_CASDOOR_ISSUER = undefined;
      expect(() =>
        new CasdoorClient({ clientId: 'id', clientSecret: 'secret' }),
      ).toThrow('Casdoor configuration is incomplete');
    });

    it('should throw when clientId is missing from config and env', () => {
      mockAuthEnvValues.AUTH_CASDOOR_ID = undefined;
      expect(() =>
        new CasdoorClient({ issuer: 'https://example.com', clientSecret: 'secret' }),
      ).toThrow('Casdoor configuration is incomplete');
    });

    it('should throw when clientSecret is missing from config and env', () => {
      mockAuthEnvValues.AUTH_CASDOOR_SECRET = undefined;
      expect(() =>
        new CasdoorClient({ issuer: 'https://example.com', clientId: 'id' }),
      ).toThrow('Casdoor configuration is incomplete');
    });

    it('should throw when all configuration is missing', () => {
      mockAuthEnvValues.AUTH_CASDOOR_ISSUER = undefined;
      mockAuthEnvValues.AUTH_CASDOOR_ID = undefined;
      mockAuthEnvValues.AUTH_CASDOOR_SECRET = undefined;
      expect(() => new CasdoorClient()).toThrow('Casdoor configuration is incomplete');
    });
  });

  describe('getToken', () => {
    let client: CasdoorClient;

    beforeEach(() => {
      client = new CasdoorClient(defaultConfig);
    });

    it('should return token response on success', async () => {
      const tokenResponse = {
        access_token: 'test-access-token',
        expires_in: 3600,
        refresh_token: 'test-refresh-token',
        scope: 'openid profile email',
        token_type: 'Bearer',
      };
      mockFetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(tokenResponse),
        ok: true,
      });

      const result = await client.getToken('user@example.com', 'password123');

      expect(result).toEqual(tokenResponse);
    });

    it('should POST to the correct token endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce({ access_token: 'tok', token_type: 'Bearer', expires_in: 3600 }),
        ok: true,
      });

      await client.getToken('testuser', 'testpass');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://casdoor.example.com/api/login/oauth/access_token',
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          method: 'POST',
        }),
      );
    });

    it('should include username, password, and grant_type in request body', async () => {
      mockFetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce({ access_token: 'tok', token_type: 'Bearer', expires_in: 3600 }),
        ok: true,
      });

      await client.getToken('testuser', 'testpass');

      const body: string = mockFetch.mock.calls[0][1].body;
      expect(body).toContain('username=testuser');
      expect(body).toContain('password=testpass');
      expect(body).toContain('grant_type=password');
      expect(body).toContain('client_id=test-client-id');
    });

    it('should throw with error_description when response has error field', async () => {
      mockFetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce({
          error: 'invalid_grant',
          error_description: 'Invalid username or password',
        }),
        ok: true,
      });

      await expect(client.getToken('user', 'wrong')).rejects.toThrow(
        'Invalid username or password',
      );
    });

    it('should throw with error code when error_description is absent', async () => {
      mockFetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce({ error: 'invalid_grant' }),
        ok: false,
      });

      await expect(client.getToken('user', 'wrong')).rejects.toThrow('invalid_grant');
    });

    it('should throw generic error when response is not ok and no error info', async () => {
      mockFetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce({}),
        ok: false,
      });

      await expect(client.getToken('user', 'pass')).rejects.toThrow('Authentication failed');
    });
  });

  describe('getUserInfo', () => {
    let client: CasdoorClient;

    beforeEach(() => {
      client = new CasdoorClient(defaultConfig);
    });

    it('should return user info on success', async () => {
      const userInfo = {
        aud: 'test-client-id',
        email: 'user@example.com',
        iss: 'https://casdoor.example.com',
        name: 'testuser',
        sub: 'user-123',
      };
      mockFetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce(userInfo),
        ok: true,
      });

      const result = await client.getUserInfo('test-access-token');

      expect(result).toEqual(userInfo);
    });

    it('should send Bearer token in Authorization header', async () => {
      mockFetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce({ sub: 'u1', name: 'u', email: 'u@e.com', iss: '', aud: '' }),
        ok: true,
      });

      await client.getUserInfo('test-access-token');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://casdoor.example.com/api/userinfo',
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-access-token' },
          method: 'GET',
        }),
      );
    });

    it('should throw when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      await expect(client.getUserInfo('invalid-token')).rejects.toThrow(
        'Failed to get user info',
      );
    });
  });

  describe('createUser', () => {
    let client: CasdoorClient;

    beforeEach(() => {
      client = new CasdoorClient(defaultConfig);
    });

    it('should resolve on successful creation', async () => {
      mockFetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce({ data: 'Affected', msg: '', status: 'ok' }),
        ok: true,
      });

      await expect(
        client.createUser({ email: 'new@example.com', name: 'newuser', password: 'pass123' }),
      ).resolves.toBeUndefined();
    });

    it('should auto-set displayName to name when displayName is not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce({ data: 'Affected', msg: '', status: 'ok' }),
        ok: true,
      });

      await client.createUser({ email: 'new@example.com', name: 'newuser', password: 'pass123' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.displayName).toBe('newuser');
    });

    it('should preserve explicitly provided displayName', async () => {
      mockFetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce({ data: 'Affected', msg: '', status: 'ok' }),
        ok: true,
      });

      await client.createUser({
        displayName: 'Display Name',
        email: 'new@example.com',
        name: 'newuser',
        password: 'pass123',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.displayName).toBe('Display Name');
    });

    it('should set owner to the organization name', async () => {
      mockFetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce({ data: 'Affected', msg: '', status: 'ok' }),
        ok: true,
      });

      await client.createUser({ email: 'new@example.com', name: 'newuser', password: 'pass123' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.owner).toBe('lobechat');
    });

    it('should default type to normal-user when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce({ data: 'Affected', msg: '', status: 'ok' }),
        ok: true,
      });

      await client.createUser({ email: 'new@example.com', name: 'newuser', password: 'pass123' });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.type).toBe('normal-user');
    });

    it('should send Basic auth header with base64-encoded credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce({ data: 'Affected', msg: '', status: 'ok' }),
        ok: true,
      });

      await client.createUser({ email: 'new@example.com', name: 'newuser', password: 'pass123' });

      const expectedAuth = `Basic ${Buffer.from('test-client-id:test-client-secret').toString('base64')}`;
      expect(mockFetch.mock.calls[0][1].headers['Authorization']).toBe(expectedAuth);
    });

    it('should throw with msg when status is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce({ msg: 'User already exists', status: 'error' }),
        ok: true,
      });

      await expect(
        client.createUser({ email: 'existing@example.com', name: 'existing', password: 'pass' }),
      ).rejects.toThrow('User already exists');
    });

    it('should throw generic error when status is not ok and msg is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValueOnce({ msg: '', status: 'error' }),
        ok: true,
      });

      await expect(
        client.createUser({ email: 'test@example.com', name: 'test', password: 'pass' }),
      ).rejects.toThrow('Failed to create user');
    });
  });

  describe('isConfigured (static)', () => {
    it('should return true when all env vars are set', () => {
      expect(CasdoorClient.isConfigured()).toBe(true);
    });

    it('should return false when issuer is not set', () => {
      mockAuthEnvValues.AUTH_CASDOOR_ISSUER = undefined;
      expect(CasdoorClient.isConfigured()).toBe(false);
    });

    it('should return false when client ID is not set', () => {
      mockAuthEnvValues.AUTH_CASDOOR_ID = undefined;
      expect(CasdoorClient.isConfigured()).toBe(false);
    });

    it('should return false when client secret is not set', () => {
      mockAuthEnvValues.AUTH_CASDOOR_SECRET = undefined;
      expect(CasdoorClient.isConfigured()).toBe(false);
    });
  });
});
