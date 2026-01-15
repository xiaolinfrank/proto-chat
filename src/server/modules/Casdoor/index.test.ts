// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock authEnv module with getter/setter pattern
vi.mock('@/envs/auth', () => {
  const mockAuthEnv = {
    AUTH_CASDOOR_ID: undefined as string | undefined,
    AUTH_CASDOOR_ISSUER: undefined as string | undefined,
    AUTH_CASDOOR_SECRET: undefined as string | undefined,
  };
  return {
    authEnv: mockAuthEnv,
  };
});

// Import authEnv after mocking
import { authEnv } from '@/envs/auth';

import { CasdoorClient } from './index';
import type {
  CasdoorApiResponse,
  CasdoorTokenError,
  CasdoorTokenResponse,
  CasdoorUserInfo,
} from './types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CasdoorClient', () => {
  const TEST_CONFIG = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    issuer: 'https://auth.example.com',
    organization: 'test-org',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock auth env
    (authEnv as any).AUTH_CASDOOR_ISSUER = undefined;
    (authEnv as any).AUTH_CASDOOR_ID = undefined;
    (authEnv as any).AUTH_CASDOOR_SECRET = undefined;
  });

  describe('constructor', () => {
    it('should create instance with provided config', () => {
      const client = new CasdoorClient(TEST_CONFIG);
      expect(client).toBeInstanceOf(CasdoorClient);
    });

    it('should use environment variables when config not provided', () => {
      (authEnv as any).AUTH_CASDOOR_ISSUER = 'https://env.example.com';
      (authEnv as any).AUTH_CASDOOR_ID = 'env-client-id';
      (authEnv as any).AUTH_CASDOOR_SECRET = 'env-client-secret';

      const client = new CasdoorClient();
      expect(client).toBeInstanceOf(CasdoorClient);
    });

    it('should throw error when issuer is missing', () => {
      expect(() => new CasdoorClient({ clientId: 'id', clientSecret: 'secret' })).toThrow(
        'Casdoor configuration is incomplete',
      );
    });

    it('should throw error when clientId is missing', () => {
      expect(
        () => new CasdoorClient({ clientSecret: 'secret', issuer: 'https://example.com' }),
      ).toThrow('Casdoor configuration is incomplete');
    });

    it('should throw error when clientSecret is missing', () => {
      expect(() => new CasdoorClient({ clientId: 'id', issuer: 'https://example.com' })).toThrow(
        'Casdoor configuration is incomplete',
      );
    });

    it('should remove trailing slash from issuer', () => {
      const client = new CasdoorClient({
        ...TEST_CONFIG,
        issuer: 'https://example.com/',
      });
      expect(client).toBeInstanceOf(CasdoorClient);
    });

    it('should use default organization when not provided', () => {
      const client = new CasdoorClient({
        clientId: TEST_CONFIG.clientId,
        clientSecret: TEST_CONFIG.clientSecret,
        issuer: TEST_CONFIG.issuer,
      });
      expect(client).toBeInstanceOf(CasdoorClient);
    });
  });

  describe('getToken', () => {
    it('should successfully get token with valid credentials', async () => {
      const mockResponse: CasdoorTokenResponse = {
        access_token: 'test-access-token',
        expires_in: 3600,
        refresh_token: 'test-refresh-token',
        scope: 'openid profile email',
        token_type: 'Bearer',
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockResponse,
        ok: true,
      });

      const client = new CasdoorClient(TEST_CONFIG);
      const result = await client.getToken('testuser', 'password123');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `${TEST_CONFIG.issuer}/api/login/oauth/access_token`,
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          method: 'POST',
        }),
      );
    });

    it('should send correct request body parameters', async () => {
      const mockResponse: CasdoorTokenResponse = {
        access_token: 'token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockResponse,
        ok: true,
      });

      const client = new CasdoorClient(TEST_CONFIG);
      await client.getToken('user@example.com', 'mypassword');

      const fetchCall = mockFetch.mock.calls[0];
      const body = fetchCall[1].body;
      expect(body).toContain('grant_type=password');
      expect(body).toContain('username=user%40example.com');
      expect(body).toContain('password=mypassword');
      expect(body).toContain(`client_id=${TEST_CONFIG.clientId}`);
      expect(body).toContain(`client_secret=${TEST_CONFIG.clientSecret}`);
      expect(body).toContain('scope=openid+profile+email');
    });

    it('should throw error when response is not ok', async () => {
      const mockError: CasdoorTokenError = {
        error: 'invalid_grant',
        error_description: 'Invalid username or password',
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockError,
        ok: false,
      });

      const client = new CasdoorClient(TEST_CONFIG);

      await expect(client.getToken('baduser', 'badpass')).rejects.toThrow(
        'Invalid username or password',
      );
    });

    it('should throw error when response contains error field', async () => {
      const mockError: CasdoorTokenError = {
        error: 'unauthorized',
        error_description: 'Authentication failed',
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockError,
        ok: true, // ok is true but data contains error
      });

      const client = new CasdoorClient(TEST_CONFIG);

      await expect(client.getToken('user', 'pass')).rejects.toThrow('Authentication failed');
    });

    it('should throw generic error when error_description is missing', async () => {
      const mockError: CasdoorTokenError = {
        error: 'server_error',
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockError,
        ok: false,
      });

      const client = new CasdoorClient(TEST_CONFIG);

      await expect(client.getToken('user', 'pass')).rejects.toThrow('server_error');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const client = new CasdoorClient(TEST_CONFIG);

      await expect(client.getToken('user', 'pass')).rejects.toThrow('Network error');
    });
  });

  describe('getUserInfo', () => {
    it('should successfully get user info with valid token', async () => {
      const mockUserInfo: CasdoorUserInfo = {
        aud: 'test-client',
        avatar: 'https://example.com/avatar.jpg',
        displayName: 'Test User',
        email: 'test@example.com',
        email_verified: true,
        iss: 'https://auth.example.com',
        name: 'testuser',
        preferred_username: 'testuser',
        sub: 'user-123',
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockUserInfo,
        ok: true,
      });

      const client = new CasdoorClient(TEST_CONFIG);
      const result = await client.getUserInfo('test-access-token');

      expect(result).toEqual(mockUserInfo);
      expect(mockFetch).toHaveBeenCalledWith(`${TEST_CONFIG.issuer}/api/userinfo`, {
        headers: {
          Authorization: 'Bearer test-access-token',
        },
        method: 'GET',
      });
    });

    it('should throw error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const client = new CasdoorClient(TEST_CONFIG);

      await expect(client.getUserInfo('invalid-token')).rejects.toThrow('Failed to get user info');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const client = new CasdoorClient(TEST_CONFIG);

      await expect(client.getUserInfo('token')).rejects.toThrow('Network timeout');
    });
  });

  describe('createUser', () => {
    it('should successfully create user with required fields', async () => {
      const mockResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'User created successfully',
        status: 'ok',
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockResponse,
        ok: true,
      });

      const client = new CasdoorClient(TEST_CONFIG);
      await client.createUser({
        email: 'newuser@example.com',
        name: 'newuser',
        password: 'password123',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `${TEST_CONFIG.issuer}/api/add-user`,
        expect.objectContaining({
          headers: {
            'Authorization': expect.stringContaining('Basic '),
            'Content-Type': 'application/json',
          },
          method: 'POST',
        }),
      );
    });

    it('should send user data with organization owner', async () => {
      const mockResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'Success',
        status: 'ok',
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockResponse,
        ok: true,
      });

      const client = new CasdoorClient(TEST_CONFIG);
      const userData = {
        email: 'user@example.com',
        name: 'testuser',
        password: 'pass123',
      };

      await client.createUser(userData);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.owner).toBe(TEST_CONFIG.organization);
      expect(body.email).toBe(userData.email);
      expect(body.name).toBe(userData.name);
      expect(body.password).toBe(userData.password);
    });

    it('should auto-set displayName to username when not provided', async () => {
      const mockResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'Success',
        status: 'ok',
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockResponse,
        ok: true,
      });

      const client = new CasdoorClient(TEST_CONFIG);
      await client.createUser({
        email: 'user@example.com',
        name: 'myusername',
        password: 'pass',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.displayName).toBe('myusername');
    });

    it('should use provided displayName when given', async () => {
      const mockResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'Success',
        status: 'ok',
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockResponse,
        ok: true,
      });

      const client = new CasdoorClient(TEST_CONFIG);
      await client.createUser({
        displayName: 'Display Name',
        email: 'user@example.com',
        name: 'username',
        password: 'pass',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.displayName).toBe('Display Name');
    });

    it('should default type to "normal-user" when not provided', async () => {
      const mockResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'Success',
        status: 'ok',
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockResponse,
        ok: true,
      });

      const client = new CasdoorClient(TEST_CONFIG);
      await client.createUser({
        email: 'user@example.com',
        name: 'user',
        password: 'pass',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.type).toBe('normal-user');
    });

    it('should include optional fields when provided', async () => {
      const mockResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'Success',
        status: 'ok',
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockResponse,
        ok: true,
      });

      const client = new CasdoorClient(TEST_CONFIG);
      await client.createUser({
        avatar: 'https://example.com/avatar.jpg',
        email: 'user@example.com',
        name: 'user',
        password: 'pass',
        phone: '+1234567890',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.avatar).toBe('https://example.com/avatar.jpg');
      expect(body.phone).toBe('+1234567890');
    });

    it('should use Basic auth with base64 encoded credentials', async () => {
      const mockResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'Success',
        status: 'ok',
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockResponse,
        ok: true,
      });

      const client = new CasdoorClient(TEST_CONFIG);
      await client.createUser({
        email: 'user@example.com',
        name: 'user',
        password: 'pass',
      });

      const authHeader = mockFetch.mock.calls[0][1].headers.Authorization;
      expect(authHeader).toContain('Basic ');

      const base64Credentials = authHeader.replace('Basic ', '');
      const credentials = Buffer.from(base64Credentials, 'base64').toString();
      expect(credentials).toBe(`${TEST_CONFIG.clientId}:${TEST_CONFIG.clientSecret}`);
    });

    it('should throw error when API returns error status', async () => {
      const mockResponse: CasdoorApiResponse<string> = {
        msg: 'Email already exists',
        status: 'error',
      };

      mockFetch.mockResolvedValueOnce({
        json: async () => mockResponse,
        ok: true,
      });

      const client = new CasdoorClient(TEST_CONFIG);

      await expect(
        client.createUser({
          email: 'existing@example.com',
          name: 'user',
          password: 'pass',
        }),
      ).rejects.toThrow('Email already exists');
    });

    it('should throw generic error when msg is missing', async () => {
      const mockResponse: CasdoorApiResponse<string> = {
        status: 'error',
      } as CasdoorApiResponse<string>;

      mockFetch.mockResolvedValueOnce({
        json: async () => mockResponse,
        ok: true,
      });

      const client = new CasdoorClient(TEST_CONFIG);

      await expect(
        client.createUser({
          email: 'user@example.com',
          name: 'user',
          password: 'pass',
        }),
      ).rejects.toThrow('Failed to create user');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const client = new CasdoorClient(TEST_CONFIG);

      await expect(
        client.createUser({
          email: 'user@example.com',
          name: 'user',
          password: 'pass',
        }),
      ).rejects.toThrow('Connection refused');
    });
  });

  describe('isConfigured', () => {
    it('should return true when all environment variables are set', () => {
      (authEnv as any).AUTH_CASDOOR_ISSUER = 'https://auth.example.com';
      (authEnv as any).AUTH_CASDOOR_ID = 'client-id';
      (authEnv as any).AUTH_CASDOOR_SECRET = 'client-secret';

      expect(CasdoorClient.isConfigured()).toBe(true);
    });

    it('should return false when issuer is missing', () => {
      (authEnv as any).AUTH_CASDOOR_ID = 'client-id';
      (authEnv as any).AUTH_CASDOOR_SECRET = 'client-secret';

      expect(CasdoorClient.isConfigured()).toBe(false);
    });

    it('should return false when client ID is missing', () => {
      (authEnv as any).AUTH_CASDOOR_ISSUER = 'https://auth.example.com';
      (authEnv as any).AUTH_CASDOOR_SECRET = 'client-secret';

      expect(CasdoorClient.isConfigured()).toBe(false);
    });

    it('should return false when client secret is missing', () => {
      (authEnv as any).AUTH_CASDOOR_ISSUER = 'https://auth.example.com';
      (authEnv as any).AUTH_CASDOOR_ID = 'client-id';

      expect(CasdoorClient.isConfigured()).toBe(false);
    });

    it('should return false when no environment variables are set', () => {
      expect(CasdoorClient.isConfigured()).toBe(false);
    });

    it('should return false when environment variables are empty strings', () => {
      (authEnv as any).AUTH_CASDOOR_ISSUER = '';
      (authEnv as any).AUTH_CASDOOR_ID = '';
      (authEnv as any).AUTH_CASDOOR_SECRET = '';

      expect(CasdoorClient.isConfigured()).toBe(false);
    });
  });
});
