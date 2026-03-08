// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock authEnv so constructor can use env-based config
vi.mock('@/envs/auth', () => ({
  authEnv: {
    AUTH_CASDOOR_ID: 'env-client-id',
    AUTH_CASDOOR_ISSUER: 'https://casdoor.env.example.com',
    AUTH_CASDOOR_SECRET: 'env-client-secret',
  },
}));

import { CasdoorClient } from './index';

const TEST_CONFIG = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  issuer: 'https://casdoor.example.com',
};

describe('CasdoorClient', () => {
  let client: CasdoorClient;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    client = new CasdoorClient(TEST_CONFIG);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should create client with explicit config', () => {
      const c = new CasdoorClient(TEST_CONFIG);
      expect(c).toBeInstanceOf(CasdoorClient);
    });

    it('should strip trailing slash from issuer URL', async () => {
      const c = new CasdoorClient({ ...TEST_CONFIG, issuer: 'https://casdoor.example.com/' });
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ access_token: 'tok', expires_in: 3600, token_type: 'Bearer' }),
        ok: true,
      });
      await c.getToken('user', 'pass');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://casdoor.example.com/api/login/oauth/access_token',
        expect.anything(),
      );
    });

    it('should use env-based config when no explicit config is provided', () => {
      const c = new CasdoorClient();
      expect(c).toBeInstanceOf(CasdoorClient);
    });

    it('should default organization to "lobechat"', async () => {
      const c = new CasdoorClient(TEST_CONFIG);
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'ok' }),
        ok: true,
      });
      await c.createUser({ email: 'u@e.com', name: 'u', password: 'p' });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.owner).toBe('lobechat');
    });

    it('should accept custom organization', async () => {
      const c = new CasdoorClient({ ...TEST_CONFIG, organization: 'my-org' });
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'ok' }),
        ok: true,
      });
      await c.createUser({ email: 'u@e.com', name: 'u', password: 'p' });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.owner).toBe('my-org');
    });

    it('should not throw when all required fields are provided explicitly', () => {
      expect(
        () =>
          new CasdoorClient({
            clientId: 'id',
            clientSecret: 'secret',
            issuer: 'https://example.com',
          }),
      ).not.toThrow();
    });

    it('should fall back to env vars when explicit config fields are empty strings', () => {
      // Empty strings are falsy, so constructor falls back to mocked authEnv values
      expect(() => new CasdoorClient({ clientId: '', clientSecret: '', issuer: '' })).not.toThrow();
    });
  });

  describe('getToken', () => {
    it('should return token response on successful authentication', async () => {
      const tokenResponse = {
        access_token: 'test-access-token',
        expires_in: 3600,
        refresh_token: 'test-refresh-token',
        token_type: 'Bearer',
      };
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(tokenResponse),
        ok: true,
      });

      const result = await client.getToken('user@example.com', 'password123');

      expect(result).toEqual(tokenResponse);
    });

    it('should call the correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ access_token: 'tok', expires_in: 3600, token_type: 'Bearer' }),
        ok: true,
      });
      await client.getToken('user', 'pass');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://casdoor.example.com/api/login/oauth/access_token',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should send correct Content-Type header', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ access_token: 'tok', expires_in: 3600, token_type: 'Bearer' }),
        ok: true,
      });
      await client.getToken('user', 'pass');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
    });

    it('should throw error using error_description when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ error: 'invalid_grant', error_description: 'Invalid credentials' }),
        ok: false,
      });
      await expect(client.getToken('user@example.com', 'wrongpassword')).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw error using error field when error_description is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ error: 'server_error' }),
        ok: false,
      });
      await expect(client.getToken('user', 'pass')).rejects.toThrow('server_error');
    });

    it('should throw error when response contains error field even if ok', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({ error: 'invalid_client', error_description: 'Unknown client' }),
        ok: true,
      });
      await expect(client.getToken('user', 'pass')).rejects.toThrow('Unknown client');
    });

    it('should throw generic error when neither error nor description provided', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ error: undefined }),
        ok: false,
      });
      await expect(client.getToken('user', 'pass')).rejects.toThrow('Authentication failed');
    });
  });

  describe('getUserInfo', () => {
    it('should return user info on success', async () => {
      const userInfo = {
        aud: 'test-client-id',
        email: 'user@example.com',
        iss: 'https://casdoor.example.com',
        name: 'testuser',
        sub: 'user-id-123',
      };
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(userInfo),
        ok: true,
      });

      const result = await client.getUserInfo('test-access-token');
      expect(result).toEqual(userInfo);
    });

    it('should call the correct endpoint with Bearer token', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({}),
        ok: true,
      });
      await client.getUserInfo('my-token');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://casdoor.example.com/api/userinfo',
        expect.objectContaining({
          headers: { Authorization: 'Bearer my-token' },
          method: 'GET',
        }),
      );
    });

    it('should throw error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      await expect(client.getUserInfo('invalid-token')).rejects.toThrow('Failed to get user info');
    });
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ data: 'Affected', msg: '', status: 'ok' }),
        ok: true,
      });
      await expect(
        client.createUser({ email: 'newuser@example.com', name: 'newuser', password: 'password123' }),
      ).resolves.toBeUndefined();
    });

    it('should auto-set displayName from name when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'ok' }),
        ok: true,
      });
      await client.createUser({ email: 'user@example.com', name: 'username', password: 'pass' });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.displayName).toBe('username');
    });

    it('should use provided displayName over name', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'ok' }),
        ok: true,
      });
      await client.createUser({
        displayName: 'Display Name',
        email: 'user@example.com',
        name: 'username',
        password: 'pass',
      });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.displayName).toBe('Display Name');
    });

    it('should default type to normal-user when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'ok' }),
        ok: true,
      });
      await client.createUser({ email: 'u@e.com', name: 'u', password: 'p' });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.type).toBe('normal-user');
    });

    it('should use provided type when specified', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'ok' }),
        ok: true,
      });
      await client.createUser({ email: 'u@e.com', name: 'u', password: 'p', type: 'admin' });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.type).toBe('admin');
    });

    it('should send request to correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'ok' }),
        ok: true,
      });
      await client.createUser({ email: 'u@e.com', name: 'u', password: 'p' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://casdoor.example.com/api/add-user',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should send Basic auth header with base64 encoded credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'ok' }),
        ok: true,
      });
      await client.createUser({ email: 'u@e.com', name: 'u', password: 'p' });
      const expectedAuth = `Basic ${Buffer.from('test-client-id:test-client-secret').toString('base64')}`;
      expect(mockFetch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: expectedAuth }),
        }),
      );
    });

    it('should throw error when creation fails with error message', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ msg: 'User already exists', status: 'error' }),
        ok: true,
      });
      await expect(
        client.createUser({ email: 'existing@example.com', name: 'existing', password: 'pass' }),
      ).rejects.toThrow('User already exists');
    });

    it('should throw generic error when no message provided on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ msg: '', status: 'error' }),
        ok: true,
      });
      await expect(
        client.createUser({ email: 'u@e.com', name: 'u', password: 'p' }),
      ).rejects.toThrow('Failed to create user');
    });
  });

  describe('isConfigured', () => {
    it('should return true when all required env vars are set', () => {
      expect(CasdoorClient.isConfigured()).toBe(true);
    });
  });
});
