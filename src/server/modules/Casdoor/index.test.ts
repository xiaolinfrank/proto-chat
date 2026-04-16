// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CasdoorClient } from './index';

// Use vi.hoisted so the mock variable is available inside the vi.mock factory
const mockAuthEnv = vi.hoisted(() => ({
  AUTH_CASDOOR_ID: 'test-client-id',
  AUTH_CASDOOR_ISSUER: 'https://casdoor.example.com',
  AUTH_CASDOOR_ROPC_ENABLED: false,
  AUTH_CASDOOR_SECRET: 'test-client-secret',
}));

vi.mock('@/envs/auth', () => ({
  authEnv: mockAuthEnv,
}));

// Helper: build a minimal fetch Response
const mockFetchResponse = (body: unknown, ok = true, status = 200) => {
  return Promise.resolve({
    json: () => Promise.resolve(body),
    ok,
    status,
  } as Response);
};

// Helper: extract RequestInit from a mock fetch call
const getCallRequestInit = (mockFn: ReturnType<typeof vi.fn>, callIndex = 0): RequestInit =>
  mockFn.mock.calls[callIndex][1] as RequestInit;

describe('CasdoorClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset env mock to full valid state before each test
    mockAuthEnv.AUTH_CASDOOR_ISSUER = 'https://casdoor.example.com';
    mockAuthEnv.AUTH_CASDOOR_ID = 'test-client-id';
    mockAuthEnv.AUTH_CASDOOR_SECRET = 'test-client-secret';

    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ─── Constructor ────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should initialize successfully using environment variables', () => {
      expect(() => new CasdoorClient()).not.toThrow();
    });

    it('should initialize successfully with explicit config', () => {
      expect(
        () =>
          new CasdoorClient({
            clientId: 'explicit-id',
            clientSecret: 'explicit-secret',
            issuer: 'https://my-casdoor.local',
          }),
      ).not.toThrow();
    });

    it('should strip trailing slash from issuer URL', () => {
      const client = new CasdoorClient({
        clientId: 'id',
        clientSecret: 'secret',
        issuer: 'https://casdoor.example.com/',
      });
      fetchMock.mockReturnValueOnce(
        mockFetchResponse({ access_token: 'tok', expires_in: 3600, token_type: 'Bearer' }),
      );

      client.getToken('user', 'pass');

      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toBe('https://casdoor.example.com/api/login/oauth/access_token');
    });

    it('should default organization to "lobechat"', async () => {
      const client = new CasdoorClient({
        clientId: 'id',
        clientSecret: 'secret',
        issuer: 'https://casdoor.example.com',
      });

      fetchMock.mockReturnValueOnce(mockFetchResponse({ status: 'ok', msg: '' }));

      await client.createUser({ email: 'a@b.com', name: 'alice', password: 'pw123' });

      const body = JSON.parse(getCallRequestInit(fetchMock).body as string);
      expect(body.owner).toBe('lobechat');
    });

    it('should use custom organization when provided', async () => {
      const client = new CasdoorClient({
        clientId: 'id',
        clientSecret: 'secret',
        issuer: 'https://casdoor.example.com',
        organization: 'my-org',
      });

      fetchMock.mockReturnValueOnce(mockFetchResponse({ status: 'ok', msg: '' }));

      await client.createUser({ email: 'a@b.com', name: 'alice', password: 'pw123' });

      const body = JSON.parse(getCallRequestInit(fetchMock).body as string);
      expect(body.owner).toBe('my-org');
    });

    it('should throw when issuer is missing from both config and env', () => {
      mockAuthEnv.AUTH_CASDOOR_ISSUER = '';
      // config.issuer is undefined → falls back to empty env var → throws
      expect(
        () => new CasdoorClient({ clientId: 'id', clientSecret: 'secret' }),
      ).toThrow('Casdoor configuration is incomplete');
    });

    it('should throw when clientId is missing from both config and env', () => {
      mockAuthEnv.AUTH_CASDOOR_ID = '';
      expect(
        () =>
          new CasdoorClient({ clientSecret: 'secret', issuer: 'https://casdoor.example.com' }),
      ).toThrow('Casdoor configuration is incomplete');
    });

    it('should throw when clientSecret is missing from both config and env', () => {
      mockAuthEnv.AUTH_CASDOOR_SECRET = '';
      expect(
        () => new CasdoorClient({ clientId: 'id', issuer: 'https://casdoor.example.com' }),
      ).toThrow('Casdoor configuration is incomplete');
    });

    it('should throw when env vars are not set', () => {
      mockAuthEnv.AUTH_CASDOOR_ISSUER = '';
      mockAuthEnv.AUTH_CASDOOR_ID = '';
      mockAuthEnv.AUTH_CASDOOR_SECRET = '';

      expect(() => new CasdoorClient()).toThrow('Casdoor configuration is incomplete');
    });
  });

  // ─── getToken ────────────────────────────────────────────────────────────────

  describe('getToken', () => {
    let client: CasdoorClient;

    beforeEach(() => {
      client = new CasdoorClient({
        clientId: 'test-id',
        clientSecret: 'test-secret',
        issuer: 'https://casdoor.example.com',
      });
    });

    it('should return token response on success', async () => {
      const tokenResponse = {
        access_token: 'access-token-xyz',
        expires_in: 3600,
        refresh_token: 'refresh-token-abc',
        scope: 'openid profile email',
        token_type: 'Bearer',
      };

      fetchMock.mockReturnValueOnce(mockFetchResponse(tokenResponse));

      const result = await client.getToken('user@example.com', 'password123');

      expect(result).toEqual(tokenResponse);
    });

    it('should POST to the correct token endpoint', async () => {
      fetchMock.mockReturnValueOnce(
        mockFetchResponse({ access_token: 'tok', expires_in: 3600, token_type: 'Bearer' }),
      );

      await client.getToken('user', 'pass');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://casdoor.example.com/api/login/oauth/access_token',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should send credentials and grant_type in the request body', async () => {
      fetchMock.mockReturnValueOnce(
        mockFetchResponse({ access_token: 'tok', expires_in: 3600, token_type: 'Bearer' }),
      );

      await client.getToken('alice', 'secret');

      const body = new URLSearchParams(getCallRequestInit(fetchMock).body as string);

      expect(body.get('grant_type')).toBe('password');
      expect(body.get('username')).toBe('alice');
      expect(body.get('password')).toBe('secret');
      expect(body.get('client_id')).toBe('test-id');
      expect(body.get('client_secret')).toBe('test-secret');
      expect(body.get('scope')).toBe('openid profile email');
    });

    it('should throw with error_description when server returns error field', async () => {
      fetchMock.mockReturnValueOnce(
        mockFetchResponse(
          { error: 'invalid_grant', error_description: 'Invalid username or password' },
          true, // ok = true but data.error is set
        ),
      );

      await expect(client.getToken('user', 'wrong')).rejects.toThrow(
        'Invalid username or password',
      );
    });

    it('should throw with error code when error_description is absent', async () => {
      fetchMock.mockReturnValueOnce(mockFetchResponse({ error: 'unauthorized_client' }, true));

      await expect(client.getToken('user', 'wrong')).rejects.toThrow('unauthorized_client');
    });

    it('should throw "Authentication failed" when error fields are absent and response is not ok', async () => {
      fetchMock.mockReturnValueOnce(mockFetchResponse({}, false, 500));

      await expect(client.getToken('user', 'pass')).rejects.toThrow('Authentication failed');
    });
  });

  // ─── getUserInfo ─────────────────────────────────────────────────────────────

  describe('getUserInfo', () => {
    let client: CasdoorClient;

    beforeEach(() => {
      client = new CasdoorClient({
        clientId: 'test-id',
        clientSecret: 'test-secret',
        issuer: 'https://casdoor.example.com',
      });
    });

    it('should return user info on success', async () => {
      const userInfo = {
        aud: 'test-id',
        email: 'alice@example.com',
        iss: 'https://casdoor.example.com',
        name: 'alice',
        sub: 'user-123',
      };

      fetchMock.mockReturnValueOnce(mockFetchResponse(userInfo));

      const result = await client.getUserInfo('valid-access-token');

      expect(result).toEqual(userInfo);
    });

    it('should send GET to the userinfo endpoint with Bearer token', async () => {
      fetchMock.mockReturnValueOnce(
        mockFetchResponse({ sub: 'u1', name: 'u', email: 'u@e.com', iss: 'i', aud: 'a' }),
      );

      await client.getUserInfo('my-token');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://casdoor.example.com/api/userinfo',
        expect.objectContaining({
          headers: { Authorization: 'Bearer my-token' },
          method: 'GET',
        }),
      );
    });

    it('should throw when response is not ok', async () => {
      fetchMock.mockReturnValueOnce(mockFetchResponse({}, false, 401));

      await expect(client.getUserInfo('invalid-token')).rejects.toThrow(
        'Failed to get user info',
      );
    });
  });

  // ─── createUser ──────────────────────────────────────────────────────────────

  describe('createUser', () => {
    let client: CasdoorClient;

    beforeEach(() => {
      client = new CasdoorClient({
        clientId: 'test-id',
        clientSecret: 'test-secret',
        issuer: 'https://casdoor.example.com',
      });
    });

    it('should resolve without error on successful creation', async () => {
      fetchMock.mockReturnValueOnce(mockFetchResponse({ status: 'ok', msg: 'Affected' }));

      await expect(
        client.createUser({ email: 'bob@example.com', name: 'bob', password: 'pw' }),
      ).resolves.toBeUndefined();
    });

    it('should POST to the add-user endpoint with Basic auth', async () => {
      fetchMock.mockReturnValueOnce(mockFetchResponse({ status: 'ok', msg: '' }));

      await client.createUser({ email: 'bob@example.com', name: 'bob', password: 'pw' });

      const requestInit = getCallRequestInit(fetchMock);
      const url = fetchMock.mock.calls[0][0] as string;
      const expectedAuth = `Basic ${Buffer.from('test-id:test-secret').toString('base64')}`;

      expect(url).toBe('https://casdoor.example.com/api/add-user');
      expect((requestInit.headers as Record<string, string>)['Authorization']).toBe(expectedAuth);
      expect(requestInit.method).toBe('POST');
    });

    it('should auto-set displayName to name when not provided', async () => {
      fetchMock.mockReturnValueOnce(mockFetchResponse({ status: 'ok', msg: '' }));

      await client.createUser({ email: 'bob@example.com', name: 'bob', password: 'pw' });

      const body = JSON.parse(getCallRequestInit(fetchMock).body as string);
      expect(body.displayName).toBe('bob');
    });

    it('should keep explicit displayName when provided', async () => {
      fetchMock.mockReturnValueOnce(mockFetchResponse({ status: 'ok', msg: '' }));

      await client.createUser({
        displayName: 'Bobby Tables',
        email: 'bob@example.com',
        name: 'bob',
        password: 'pw',
      });

      const body = JSON.parse(getCallRequestInit(fetchMock).body as string);
      expect(body.displayName).toBe('Bobby Tables');
    });

    it('should default user type to "normal-user"', async () => {
      fetchMock.mockReturnValueOnce(mockFetchResponse({ status: 'ok', msg: '' }));

      await client.createUser({ email: 'bob@example.com', name: 'bob', password: 'pw' });

      const body = JSON.parse(getCallRequestInit(fetchMock).body as string);
      expect(body.type).toBe('normal-user');
    });

    it('should use provided type when specified', async () => {
      fetchMock.mockReturnValueOnce(mockFetchResponse({ status: 'ok', msg: '' }));

      await client.createUser({
        email: 'admin@example.com',
        name: 'admin',
        password: 'pw',
        type: 'global-admin',
      });

      const body = JSON.parse(getCallRequestInit(fetchMock).body as string);
      expect(body.type).toBe('global-admin');
    });

    it('should throw with server message when status is not ok', async () => {
      fetchMock.mockReturnValueOnce(
        mockFetchResponse({ status: 'error', msg: 'User already exists' }),
      );

      await expect(
        client.createUser({ email: 'bob@example.com', name: 'bob', password: 'pw' }),
      ).rejects.toThrow('User already exists');
    });

    it('should throw "Failed to create user" when msg is absent and status is error', async () => {
      fetchMock.mockReturnValueOnce(mockFetchResponse({ status: 'error', msg: '' }));

      await expect(
        client.createUser({ email: 'bob@example.com', name: 'bob', password: 'pw' }),
      ).rejects.toThrow('Failed to create user');
    });
  });

  // ─── isConfigured ────────────────────────────────────────────────────────────

  describe('isConfigured', () => {
    it('should return true when all required env vars are set', () => {
      mockAuthEnv.AUTH_CASDOOR_ISSUER = 'https://casdoor.example.com';
      mockAuthEnv.AUTH_CASDOOR_ID = 'test-id';
      mockAuthEnv.AUTH_CASDOOR_SECRET = 'test-secret';

      expect(CasdoorClient.isConfigured()).toBe(true);
    });

    it('should return false when issuer is missing', () => {
      mockAuthEnv.AUTH_CASDOOR_ISSUER = '';

      expect(CasdoorClient.isConfigured()).toBe(false);
    });

    it('should return false when client ID is missing', () => {
      mockAuthEnv.AUTH_CASDOOR_ID = '';

      expect(CasdoorClient.isConfigured()).toBe(false);
    });

    it('should return false when client secret is missing', () => {
      mockAuthEnv.AUTH_CASDOOR_SECRET = '';

      expect(CasdoorClient.isConfigured()).toBe(false);
    });

    it('should return false when all env vars are missing', () => {
      mockAuthEnv.AUTH_CASDOOR_ISSUER = '';
      mockAuthEnv.AUTH_CASDOOR_ID = '';
      mockAuthEnv.AUTH_CASDOOR_SECRET = '';

      expect(CasdoorClient.isConfigured()).toBe(false);
    });
  });
});
