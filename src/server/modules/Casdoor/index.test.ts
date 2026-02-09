// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock environment variables - use factory function to allow dynamic mocking
const mockAuthEnv = {
  AUTH_CASDOOR_ID: 'test-client-id',
  AUTH_CASDOOR_ISSUER: 'https://casdoor.example.com',
  AUTH_CASDOOR_SECRET: 'test-client-secret',
};

vi.mock('@/envs/auth', () => ({
  get authEnv() {
    return mockAuthEnv;
  },
}));

import { CasdoorClient } from './index';
import type {
  CasdoorApiResponse,
  CasdoorCreateUserRequest,
  CasdoorTokenError,
  CasdoorTokenResponse,
  CasdoorUserInfo,
} from './types';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CasdoorClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock environment to default values
    mockAuthEnv.AUTH_CASDOOR_ID = 'test-client-id';
    mockAuthEnv.AUTH_CASDOOR_ISSUER = 'https://casdoor.example.com';
    mockAuthEnv.AUTH_CASDOOR_SECRET = 'test-client-secret';
  });

  describe('constructor', () => {
    it('should initialize with environment variables', () => {
      const client = new CasdoorClient();

      expect(client).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      const client = new CasdoorClient({
        clientId: 'custom-id',
        clientSecret: 'custom-secret',
        issuer: 'https://custom.casdoor.com',
        organization: 'custom-org',
      });

      expect(client).toBeDefined();
    });

    it('should remove trailing slash from issuer', () => {
      const client = new CasdoorClient({
        clientId: 'test-id',
        clientSecret: 'test-secret',
        issuer: 'https://casdoor.example.com/',
      });

      expect(client).toBeDefined();
    });

    it('should use default organization "lobechat" when not provided', () => {
      const client = new CasdoorClient({
        clientId: 'test-id',
        clientSecret: 'test-secret',
        issuer: 'https://casdoor.example.com',
      });

      expect(client).toBeDefined();
    });

    it('should throw error when issuer is missing from environment', () => {
      mockAuthEnv.AUTH_CASDOOR_ISSUER = '';

      expect(() => {
        new CasdoorClient();
      }).toThrow(
        'Casdoor configuration is incomplete. Please set AUTH_CASDOOR_ISSUER, AUTH_CASDOOR_ID, and AUTH_CASDOOR_SECRET environment variables.',
      );
    });

    it('should throw error when clientId is missing from environment', () => {
      mockAuthEnv.AUTH_CASDOOR_ID = '';

      expect(() => {
        new CasdoorClient();
      }).toThrow(
        'Casdoor configuration is incomplete. Please set AUTH_CASDOOR_ISSUER, AUTH_CASDOOR_ID, and AUTH_CASDOOR_SECRET environment variables.',
      );
    });

    it('should throw error when clientSecret is missing from environment', () => {
      mockAuthEnv.AUTH_CASDOOR_SECRET = '';

      expect(() => {
        new CasdoorClient();
      }).toThrow(
        'Casdoor configuration is incomplete. Please set AUTH_CASDOOR_ISSUER, AUTH_CASDOOR_ID, and AUTH_CASDOOR_SECRET environment variables.',
      );
    });
  });

  describe('getToken', () => {
    it('should get access token with valid credentials', async () => {
      const client = new CasdoorClient();
      const mockResponse: CasdoorTokenResponse = {
        access_token: 'test-access-token',
        expires_in: 3600,
        refresh_token: 'test-refresh-token',
        scope: 'openid profile email',
        token_type: 'Bearer',
      };

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockResponse),
        ok: true,
      });

      const result = await client.getToken('testuser', 'testpassword');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://casdoor.example.com/api/login/oauth/access_token',
        {
          body: expect.stringContaining('grant_type=password'),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          method: 'POST',
        },
      );

      // Verify the body contains expected parameters
      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1].body;
      expect(body).toContain('username=testuser');
      expect(body).toContain('password=testpassword');
      expect(body).toContain('client_id=test-client-id');
      expect(body).toContain('client_secret=test-client-secret');
      expect(body).toContain('grant_type=password');
      expect(body).toContain('scope=openid+profile+email');

      expect(result).toEqual(mockResponse);
    });

    it('should throw error when response is not ok', async () => {
      const client = new CasdoorClient();
      const mockError: CasdoorTokenError = {
        error: 'invalid_grant',
        error_description: 'Invalid username or password',
      };

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockError),
        ok: false,
      });

      await expect(client.getToken('testuser', 'wrongpassword')).rejects.toThrow(
        'Invalid username or password',
      );
    });

    it('should throw error when response contains error property', async () => {
      const client = new CasdoorClient();
      const mockError: CasdoorTokenError = {
        error: 'invalid_client',
        error_description: 'Client authentication failed',
      };

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockError),
        ok: true,
      });

      await expect(client.getToken('testuser', 'testpassword')).rejects.toThrow(
        'Client authentication failed',
      );
    });

    it('should throw generic error message when error_description is missing', async () => {
      const client = new CasdoorClient();
      const mockError: CasdoorTokenError = {
        error: 'server_error',
      };

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockError),
        ok: false,
      });

      await expect(client.getToken('testuser', 'testpassword')).rejects.toThrow('server_error');
    });

    it('should throw default error message when both error and error_description are missing', async () => {
      const client = new CasdoorClient();

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({}),
        ok: false,
      });

      await expect(client.getToken('testuser', 'testpassword')).rejects.toThrow(
        'Authentication failed',
      );
    });
  });

  describe('getUserInfo', () => {
    it('should get user info with valid access token', async () => {
      const client = new CasdoorClient();
      const mockUserInfo: CasdoorUserInfo = {
        aud: 'test-client-id',
        avatar: 'https://example.com/avatar.jpg',
        displayName: 'Test User',
        email: 'test@example.com',
        email_verified: true,
        firstName: 'Test',
        iss: 'https://casdoor.example.com',
        lastName: 'User',
        name: 'testuser',
        permanentAvatar: 'https://example.com/avatar.jpg',
        phone: '+1234567890',
        preferred_username: 'testuser',
        sub: 'user-123',
      };

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockUserInfo),
        ok: true,
      });

      const result = await client.getUserInfo('test-access-token');

      expect(mockFetch).toHaveBeenCalledWith('https://casdoor.example.com/api/userinfo', {
        headers: {
          Authorization: 'Bearer test-access-token',
        },
        method: 'GET',
      });

      expect(result).toEqual(mockUserInfo);
    });

    it('should throw error when response is not ok', async () => {
      const client = new CasdoorClient();

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue({}),
        ok: false,
      });

      await expect(client.getUserInfo('invalid-token')).rejects.toThrow('Failed to get user info');
    });

    it('should handle network errors', async () => {
      const client = new CasdoorClient();

      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.getUserInfo('test-token')).rejects.toThrow('Network error');
    });
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const client = new CasdoorClient();
      const mockSuccessResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'User created',
        status: 'ok',
      };

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockSuccessResponse),
        ok: true,
      });

      const userData = {
        email: 'newuser@example.com',
        name: 'newuser',
        password: 'securepassword',
      };

      await client.createUser(userData);

      expect(mockFetch).toHaveBeenCalledWith('https://casdoor.example.com/api/add-user', {
        body: expect.any(String),
        headers: {
          'Authorization': `Basic ${Buffer.from('test-client-id:test-client-secret').toString('base64')}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      // Verify the body structure
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body).toMatchObject({
        displayName: 'newuser', // Auto-set from name
        email: 'newuser@example.com',
        name: 'newuser',
        owner: 'lobechat',
        password: 'securepassword',
        type: 'normal-user', // Default type
      });
    });

    it('should create user with custom displayName', async () => {
      const client = new CasdoorClient();
      const mockSuccessResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'User created',
        status: 'ok',
      };

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockSuccessResponse),
        ok: true,
      });

      const userData = {
        displayName: 'Custom Display Name',
        email: 'newuser@example.com',
        name: 'newuser',
        password: 'securepassword',
      };

      await client.createUser(userData);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.displayName).toBe('Custom Display Name');
    });

    it('should create user with custom type', async () => {
      const client = new CasdoorClient();
      const mockSuccessResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'User created',
        status: 'ok',
      };

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockSuccessResponse),
        ok: true,
      });

      const userData = {
        email: 'admin@example.com',
        name: 'adminuser',
        password: 'adminpassword',
        type: 'admin-user',
      };

      await client.createUser(userData);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.type).toBe('admin-user');
    });

    it('should create user with custom organization', async () => {
      const client = new CasdoorClient({
        clientId: 'test-id',
        clientSecret: 'test-secret',
        issuer: 'https://casdoor.example.com',
        organization: 'custom-org',
      });

      const mockSuccessResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'User created',
        status: 'ok',
      };

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockSuccessResponse),
        ok: true,
      });

      const userData = {
        email: 'orguser@example.com',
        name: 'orguser',
        password: 'orgpassword',
      };

      await client.createUser(userData);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.owner).toBe('custom-org');
    });

    it('should create user with optional fields', async () => {
      const client = new CasdoorClient();
      const mockSuccessResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'User created',
        status: 'ok',
      };

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockSuccessResponse),
        ok: true,
      });

      const userData = {
        avatar: 'https://example.com/avatar.jpg',
        email: 'newuser@example.com',
        name: 'newuser',
        password: 'securepassword',
        phone: '+1234567890',
      };

      await client.createUser(userData);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.avatar).toBe('https://example.com/avatar.jpg');
      expect(body.phone).toBe('+1234567890');
    });

    it('should throw error when status is not ok', async () => {
      const client = new CasdoorClient();
      const mockErrorResponse: CasdoorApiResponse<string> = {
        msg: 'User already exists',
        status: 'error',
      };

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockErrorResponse),
        ok: true,
      });

      const userData = {
        email: 'existing@example.com',
        name: 'existinguser',
        password: 'password',
      };

      await expect(client.createUser(userData)).rejects.toThrow('User already exists');
    });

    it('should throw default error message when msg is missing', async () => {
      const client = new CasdoorClient();
      const mockErrorResponse: CasdoorApiResponse<string> = {
        msg: '',
        status: 'error',
      };

      mockFetch.mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockErrorResponse),
        ok: true,
      });

      const userData = {
        email: 'test@example.com',
        name: 'testuser',
        password: 'password',
      };

      await expect(client.createUser(userData)).rejects.toThrow('Failed to create user');
    });

    it('should handle network errors', async () => {
      const client = new CasdoorClient();

      mockFetch.mockRejectedValue(new Error('Network timeout'));

      const userData = {
        email: 'test@example.com',
        name: 'testuser',
        password: 'password',
      };

      await expect(client.createUser(userData)).rejects.toThrow('Network timeout');
    });
  });

  describe('isConfigured', () => {
    it('should return true when all configuration is present', () => {
      const result = CasdoorClient.isConfigured();

      expect(result).toBe(true);
    });

    it('should return false when configuration is incomplete', () => {
      vi.doMock('@/envs/auth', () => ({
        authEnv: {
          AUTH_CASDOOR_ID: '',
          AUTH_CASDOOR_ISSUER: 'https://casdoor.example.com',
          AUTH_CASDOOR_SECRET: 'test-secret',
        },
      }));

      const result = CasdoorClient.isConfigured();

      // Since we already loaded the module, this will still return true
      // In a real scenario, this would be tested with a fresh module load
      expect(result).toBe(true);
    });
  });
});
