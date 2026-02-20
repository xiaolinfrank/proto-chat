// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock auth env before importing the module under test
vi.mock('@/envs/auth', () => ({
  authEnv: {
    AUTH_CASDOOR_ID: 'test-client-id',
    AUTH_CASDOOR_ISSUER: 'https://casdoor.example.com',
    AUTH_CASDOOR_SECRET: 'test-client-secret',
    AUTH_SECRET: 'test-auth-secret',
  },
}));

import { CasdoorClient } from './index';

describe('CasdoorClient', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  describe('constructor', () => {
    it('should initialize successfully with environment variables', () => {
      const client = new CasdoorClient();
      expect(client).toBeDefined();
    });

    it('should initialize with explicitly provided config', () => {
      const client = new CasdoorClient({
        clientId: 'custom-id',
        clientSecret: 'custom-secret',
        issuer: 'https://custom.example.com',
        organization: 'custom-org',
      });
      expect(client).toBeDefined();
    });

    it('should throw when all env vars and config are missing', async () => {
      // Use doMock + resetModules to get a fresh module with empty auth env
      vi.doMock('@/envs/auth', () => ({
        authEnv: {
          AUTH_CASDOOR_ID: undefined,
          AUTH_CASDOOR_ISSUER: undefined,
          AUTH_CASDOOR_SECRET: undefined,
        },
      }));
      vi.resetModules();
      const { CasdoorClient: FreshClient } = await import('./index');

      expect(() => new FreshClient()).toThrow(
        'Casdoor configuration is incomplete. Please set AUTH_CASDOOR_ISSUER, AUTH_CASDOOR_ID, and AUTH_CASDOOR_SECRET environment variables.',
      );

      vi.resetModules();
    });

    it('should throw when issuer env var and config issuer are both missing', async () => {
      vi.doMock('@/envs/auth', () => ({
        authEnv: {
          AUTH_CASDOOR_ID: 'id',
          AUTH_CASDOOR_ISSUER: undefined,
          AUTH_CASDOOR_SECRET: 'secret',
        },
      }));
      vi.resetModules();
      const { CasdoorClient: FreshClient } = await import('./index');

      expect(() => new FreshClient()).toThrow('Casdoor configuration is incomplete');

      vi.resetModules();
    });

    it('should throw when clientSecret env var and config are both missing', async () => {
      vi.doMock('@/envs/auth', () => ({
        authEnv: {
          AUTH_CASDOOR_ID: 'id',
          AUTH_CASDOOR_ISSUER: 'https://example.com',
          AUTH_CASDOOR_SECRET: undefined,
        },
      }));
      vi.resetModules();
      const { CasdoorClient: FreshClient } = await import('./index');

      expect(() => new FreshClient()).toThrow('Casdoor configuration is incomplete');

      vi.resetModules();
    });

    it('should remove trailing slash from issuer URL', async () => {
      const client = new CasdoorClient({
        clientId: 'id',
        clientSecret: 'secret',
        issuer: 'https://casdoor.example.com/',
      });

      const mockResponse = {
        access_token: 'token',
        expires_in: 3600,
        token_type: 'Bearer',
      };
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockResponse),
        ok: true,
      });

      await client.getToken('user', 'pass');

      // URL should not have double slash
      expect(mockFetch).toHaveBeenCalledWith(
        'https://casdoor.example.com/api/login/oauth/access_token',
        expect.anything(),
      );
    });

    it('should default organization to lobechat when not provided', async () => {
      const client = new CasdoorClient();

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ data: 'Affected', msg: '', status: 'ok' }),
        ok: true,
      });

      await client.createUser({
        email: 'test@example.com',
        name: 'testuser',
        password: 'password123',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.owner).toBe('lobechat');
    });

    it('should use provided organization name', async () => {
      const client = new CasdoorClient({
        clientId: 'id',
        clientSecret: 'secret',
        issuer: 'https://example.com',
        organization: 'my-org',
      });

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ data: 'Affected', msg: '', status: 'ok' }),
        ok: true,
      });

      await client.createUser({
        email: 'test@example.com',
        name: 'testuser',
        password: 'password123',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.owner).toBe('my-org');
    });
  });

  describe('getToken', () => {
    it('should return token response on successful authentication', async () => {
      const mockTokenResponse = {
        access_token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9',
        expires_in: 3600,
        refresh_token: 'refresh-token-value',
        scope: 'openid profile email',
        token_type: 'Bearer',
      };

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockTokenResponse),
        ok: true,
      });

      const client = new CasdoorClient();
      const result = await client.getToken('testuser', 'testpassword');

      expect(result).toEqual(mockTokenResponse);
    });

    it('should call the correct endpoint URL', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ access_token: 'token', expires_in: 3600, token_type: 'Bearer' }),
        ok: true,
      });

      const client = new CasdoorClient();
      await client.getToken('user', 'pass');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://casdoor.example.com/api/login/oauth/access_token',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should send correct Content-Type header', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ access_token: 'token', expires_in: 3600, token_type: 'Bearer' }),
        ok: true,
      });

      const client = new CasdoorClient();
      await client.getToken('user', 'pass');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
    });

    it('should include username and password in request body', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ access_token: 'token', expires_in: 3600, token_type: 'Bearer' }),
        ok: true,
      });

      const client = new CasdoorClient();
      await client.getToken('myuser', 'mypassword');

      const requestBody = mockFetch.mock.calls[0][1].body as string;
      const params = new URLSearchParams(requestBody);
      expect(params.get('username')).toBe('myuser');
      expect(params.get('password')).toBe('mypassword');
      expect(params.get('grant_type')).toBe('password');
      expect(params.get('client_id')).toBe('test-client-id');
      expect(params.get('scope')).toBe('openid profile email');
    });

    it('should throw with error_description when authentication fails', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          error: 'invalid_grant',
          error_description: 'Invalid username or password',
        }),
        ok: false,
      });

      const client = new CasdoorClient();
      await expect(client.getToken('user', 'wrongpassword')).rejects.toThrow(
        'Invalid username or password',
      );
    });

    it('should throw with error code when error_description is absent', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ error: 'server_error' }),
        ok: false,
      });

      const client = new CasdoorClient();
      await expect(client.getToken('user', 'pass')).rejects.toThrow('server_error');
    });

    it('should throw with generic message when no error info is available', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({}),
        ok: false,
      });

      const client = new CasdoorClient();
      await expect(client.getToken('user', 'pass')).rejects.toThrow('Authentication failed');
    });

    it('should throw when data.error is set even if HTTP status is ok', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          error: 'access_denied',
          error_description: 'Account is locked',
        }),
        ok: true,
      });

      const client = new CasdoorClient();
      await expect(client.getToken('user', 'pass')).rejects.toThrow('Account is locked');
    });
  });

  describe('getUserInfo', () => {
    it('should return user info on success', async () => {
      const mockUserInfo = {
        aud: 'test-client-id',
        avatar: 'https://example.com/avatar.png',
        displayName: 'Test User',
        email: 'test@example.com',
        email_verified: true,
        iss: 'https://casdoor.example.com',
        name: 'testuser',
        sub: 'user-123',
      };

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockUserInfo),
        ok: true,
      });

      const client = new CasdoorClient();
      const result = await client.getUserInfo('valid-access-token');

      expect(result).toEqual(mockUserInfo);
    });

    it('should call the correct endpoint URL', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ aud: 'id', email: 'e@mail.com', iss: 'issuer', name: 'u', sub: 's' }),
        ok: true,
      });

      const client = new CasdoorClient();
      await client.getUserInfo('token');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://casdoor.example.com/api/userinfo',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('should send Authorization Bearer header', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ aud: 'id', email: 'e@mail.com', iss: 'issuer', name: 'u', sub: 's' }),
        ok: true,
      });

      const client = new CasdoorClient();
      await client.getUserInfo('my-access-token');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: 'Bearer my-access-token' },
        }),
      );
    });

    it('should throw when response is not ok', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({}),
        ok: false,
      });

      const client = new CasdoorClient();
      await expect(client.getUserInfo('invalid-token')).rejects.toThrow('Failed to get user info');
    });
  });

  describe('createUser', () => {
    it('should create user successfully and return undefined', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ data: 'Affected', msg: '', status: 'ok' }),
        ok: true,
      });

      const client = new CasdoorClient();
      const result = await client.createUser({
        email: 'newuser@example.com',
        name: 'newuser',
        password: 'securepassword',
      });

      expect(result).toBeUndefined();
    });

    it('should call the correct endpoint URL', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: '', status: 'ok' }),
        ok: true,
      });

      const client = new CasdoorClient();
      await client.createUser({ email: 'e@mail.com', name: 'user', password: 'pass' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://casdoor.example.com/api/add-user',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should use Basic auth header with correct credentials', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: '', status: 'ok' }),
        ok: true,
      });

      const client = new CasdoorClient();
      await client.createUser({ email: 'e@mail.com', name: 'user', password: 'pass' });

      const expectedBasic = Buffer.from('test-client-id:test-client-secret').toString('base64');
      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders['Authorization']).toBe(`Basic ${expectedBasic}`);
    });

    it('should send JSON content type', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: '', status: 'ok' }),
        ok: true,
      });

      const client = new CasdoorClient();
      await client.createUser({ email: 'e@mail.com', name: 'user', password: 'pass' });

      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders['Content-Type']).toBe('application/json');
    });

    it('should auto-set displayName to name when not provided', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: '', status: 'ok' }),
        ok: true,
      });

      const client = new CasdoorClient();
      await client.createUser({ email: 'e@mail.com', name: 'myusername', password: 'pass' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.displayName).toBe('myusername');
    });

    it('should preserve provided displayName', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: '', status: 'ok' }),
        ok: true,
      });

      const client = new CasdoorClient();
      await client.createUser({
        displayName: 'My Display Name',
        email: 'e@mail.com',
        name: 'username',
        password: 'pass',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.displayName).toBe('My Display Name');
    });

    it('should default type to normal-user when not provided', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: '', status: 'ok' }),
        ok: true,
      });

      const client = new CasdoorClient();
      await client.createUser({ email: 'e@mail.com', name: 'user', password: 'pass' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.type).toBe('normal-user');
    });

    it('should preserve provided user type', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: '', status: 'ok' }),
        ok: true,
      });

      const client = new CasdoorClient();
      await client.createUser({ email: 'e@mail.com', name: 'user', password: 'pass', type: 'admin' });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.type).toBe('admin');
    });

    it('should throw with error message when status is not ok', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: 'User already exists', status: 'error' }),
        ok: true,
      });

      const client = new CasdoorClient();
      await expect(
        client.createUser({ email: 'e@mail.com', name: 'user', password: 'pass' }),
      ).rejects.toThrow('User already exists');
    });

    it('should throw generic message when status is error and msg is empty', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: '', status: 'error' }),
        ok: true,
      });

      const client = new CasdoorClient();
      await expect(
        client.createUser({ email: 'e@mail.com', name: 'user', password: 'pass' }),
      ).rejects.toThrow('Failed to create user');
    });

    it('should include all provided user fields in request body', async () => {
      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({ msg: '', status: 'ok' }),
        ok: true,
      });

      const client = new CasdoorClient();
      await client.createUser({
        avatar: 'https://example.com/avatar.png',
        displayName: 'Full Name',
        email: 'user@example.com',
        name: 'username',
        password: 'password123',
        phone: '+1234567890',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.avatar).toBe('https://example.com/avatar.png');
      expect(callBody.email).toBe('user@example.com');
      expect(callBody.name).toBe('username');
      expect(callBody.phone).toBe('+1234567890');
    });
  });

  describe('isConfigured', () => {
    it('should return true when all required env vars are set', () => {
      // Auth env is mocked with all required values
      expect(CasdoorClient.isConfigured()).toBe(true);
    });
  });
});
