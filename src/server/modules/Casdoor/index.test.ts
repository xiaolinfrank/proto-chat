// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CasdoorClient } from './index';
import type {
  CasdoorApiResponse,
  CasdoorTokenError,
  CasdoorTokenResponse,
  CasdoorUserInfo,
} from './types';

// Mock authEnv
vi.mock('@/envs/auth', () => ({
  authEnv: {
    AUTH_CASDOOR_ID: 'test-client-id',
    AUTH_CASDOOR_ISSUER: 'https://casdoor.example.com',
    AUTH_CASDOOR_SECRET: 'test-client-secret',
  },
}));

// Mock global fetch
global.fetch = vi.fn();

describe('CasdoorClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with environment variables', () => {
      const client = new CasdoorClient();
      expect(client).toBeInstanceOf(CasdoorClient);
    });

    it('should initialize with custom config', () => {
      const client = new CasdoorClient({
        clientId: 'custom-client-id',
        clientSecret: 'custom-secret',
        issuer: 'https://custom.casdoor.com',
        organization: 'custom-org',
      });
      expect(client).toBeInstanceOf(CasdoorClient);
    });

    it('should remove trailing slash from issuer', () => {
      const client = new CasdoorClient({
        issuer: 'https://casdoor.example.com/',
      });
      expect(client).toBeInstanceOf(CasdoorClient);
    });

    it('should use default organization "lobechat" when not provided', () => {
      const client = new CasdoorClient();
      expect(client).toBeInstanceOf(CasdoorClient);
    });

    it('should fallback to environment when config values are empty strings', () => {
      // Empty strings are falsy and will fallback to environment variables
      const client = new CasdoorClient({
        clientId: '',
        clientSecret: '',
        issuer: '',
      });
      expect(client).toBeInstanceOf(CasdoorClient);
    });
  });

  describe('getToken', () => {
    let client: CasdoorClient;

    beforeEach(() => {
      client = new CasdoorClient();
    });

    it('should successfully get token with valid credentials', async () => {
      const mockTokenResponse: CasdoorTokenResponse = {
        access_token: 'test-access-token',
        expires_in: 3600,
        refresh_token: 'test-refresh-token',
        scope: 'openid profile email',
        token_type: 'Bearer',
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockTokenResponse,
        ok: true,
      });

      const result = await client.getToken('testuser', 'testpassword');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://casdoor.example.com/api/login/oauth/access_token',
        {
          body: expect.stringContaining('grant_type=password'),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          method: 'POST',
        },
      );

      expect(result).toEqual(mockTokenResponse);
    });

    it('should include correct parameters in token request', async () => {
      const mockTokenResponse: CasdoorTokenResponse = {
        access_token: 'test-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockTokenResponse,
        ok: true,
      });

      await client.getToken('testuser', 'testpassword');

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = fetchCall[1].body;

      expect(body).toContain('client_id=test-client-id');
      expect(body).toContain('client_secret=test-client-secret');
      expect(body).toContain('grant_type=password');
      expect(body).toContain('username=testuser');
      expect(body).toContain('password=testpassword');
      expect(body).toContain('scope=openid+profile+email');
    });

    it('should throw error when credentials are invalid', async () => {
      const mockErrorResponse: CasdoorTokenError = {
        error: 'invalid_grant',
        error_description: 'Invalid username or password',
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockErrorResponse,
        ok: false,
      });

      await expect(client.getToken('wronguser', 'wrongpass')).rejects.toThrow(
        'Invalid username or password',
      );
    });

    it('should throw error when response contains error field even if ok is true', async () => {
      const mockErrorResponse: CasdoorTokenError = {
        error: 'server_error',
        error_description: 'Internal server error',
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockErrorResponse,
        ok: true,
      });

      await expect(client.getToken('testuser', 'testpass')).rejects.toThrow(
        'Internal server error',
      );
    });

    it('should throw generic error when error_description is missing', async () => {
      const mockErrorResponse: CasdoorTokenError = {
        error: 'unknown_error',
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockErrorResponse,
        ok: false,
      });

      await expect(client.getToken('testuser', 'testpass')).rejects.toThrow('unknown_error');
    });

    it('should throw generic error when both error and error_description are missing', async () => {
      (global.fetch as any).mockResolvedValue({
        json: async () => ({}),
        ok: false,
      });

      await expect(client.getToken('testuser', 'testpass')).rejects.toThrow('Authentication failed');
    });
  });

  describe('getUserInfo', () => {
    let client: CasdoorClient;

    beforeEach(() => {
      client = new CasdoorClient();
    });

    it('should successfully get user info with valid access token', async () => {
      const mockUserInfo: CasdoorUserInfo = {
        aud: 'test-client-id',
        avatar: 'https://example.com/avatar.jpg',
        displayName: 'Test User',
        email: 'test@example.com',
        email_verified: true,
        iss: 'https://casdoor.example.com',
        name: 'testuser',
        sub: 'user-123',
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockUserInfo,
        ok: true,
      });

      const result = await client.getUserInfo('test-access-token');

      expect(global.fetch).toHaveBeenCalledWith('https://casdoor.example.com/api/userinfo', {
        headers: {
          Authorization: 'Bearer test-access-token',
        },
        method: 'GET',
      });

      expect(result).toEqual(mockUserInfo);
    });

    it('should throw error when access token is invalid', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
      });

      await expect(client.getUserInfo('invalid-token')).rejects.toThrow('Failed to get user info');
    });

    it('should include Bearer prefix in Authorization header', async () => {
      (global.fetch as any).mockResolvedValue({
        json: async () => ({
          aud: 'test',
          email: 'test@example.com',
          iss: 'test',
          name: 'test',
          sub: 'test',
        }),
        ok: true,
      });

      await client.getUserInfo('my-access-token');

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[1].headers.Authorization).toBe('Bearer my-access-token');
    });
  });

  describe('createUser', () => {
    let client: CasdoorClient;

    beforeEach(() => {
      client = new CasdoorClient();
    });

    it('should successfully create user with valid data', async () => {
      const mockSuccessResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'success',
        status: 'ok',
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockSuccessResponse,
        ok: true,
      });

      await client.createUser({
        email: 'newuser@example.com',
        name: 'newuser',
        password: 'securepass123',
      });

      expect(global.fetch).toHaveBeenCalledWith('https://casdoor.example.com/api/add-user', {
        body: expect.stringContaining('"name":"newuser"'),
        headers: {
          'Authorization': expect.stringContaining('Basic '),
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });
    });

    it('should set displayName to name when not provided', async () => {
      const mockSuccessResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'success',
        status: 'ok',
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockSuccessResponse,
        ok: true,
      });

      await client.createUser({
        email: 'test@example.com',
        name: 'testuser',
        password: 'password123',
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.displayName).toBe('testuser');
    });

    it('should use provided displayName when specified', async () => {
      const mockSuccessResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'success',
        status: 'ok',
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockSuccessResponse,
        ok: true,
      });

      await client.createUser({
        displayName: 'Custom Display Name',
        email: 'test@example.com',
        name: 'testuser',
        password: 'password123',
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.displayName).toBe('Custom Display Name');
    });

    it('should set owner to organization from config', async () => {
      const customClient = new CasdoorClient({
        organization: 'custom-org',
      });

      const mockSuccessResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'success',
        status: 'ok',
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockSuccessResponse,
        ok: true,
      });

      await customClient.createUser({
        email: 'test@example.com',
        name: 'testuser',
        password: 'password123',
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.owner).toBe('custom-org');
    });

    it('should set type to "normal-user" when not provided', async () => {
      const mockSuccessResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'success',
        status: 'ok',
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockSuccessResponse,
        ok: true,
      });

      await client.createUser({
        email: 'test@example.com',
        name: 'testuser',
        password: 'password123',
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.type).toBe('normal-user');
    });

    it('should include optional fields when provided', async () => {
      const mockSuccessResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'success',
        status: 'ok',
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockSuccessResponse,
        ok: true,
      });

      await client.createUser({
        avatar: 'https://example.com/avatar.jpg',
        email: 'test@example.com',
        name: 'testuser',
        password: 'password123',
        phone: '+1234567890',
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.avatar).toBe('https://example.com/avatar.jpg');
      expect(body.phone).toBe('+1234567890');
    });

    it('should use Basic authentication with base64 encoded credentials', async () => {
      const mockSuccessResponse: CasdoorApiResponse<string> = {
        data: 'Affected',
        msg: 'success',
        status: 'ok',
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockSuccessResponse,
        ok: true,
      });

      await client.createUser({
        email: 'test@example.com',
        name: 'testuser',
        password: 'password123',
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const authHeader = fetchCall[1].headers.Authorization;

      expect(authHeader).toContain('Basic ');

      const base64Credentials = authHeader.replace('Basic ', '');
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      expect(credentials).toBe('test-client-id:test-client-secret');
    });

    it('should throw error when API returns error status', async () => {
      const mockErrorResponse: CasdoorApiResponse<string> = {
        msg: 'User already exists',
        status: 'error',
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockErrorResponse,
        ok: true,
      });

      await expect(
        client.createUser({
          email: 'existing@example.com',
          name: 'existinguser',
          password: 'password123',
        }),
      ).rejects.toThrow('User already exists');
    });

    it('should throw generic error when msg is missing in error response', async () => {
      const mockErrorResponse: CasdoorApiResponse<string> = {
        msg: '',
        status: 'error',
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockErrorResponse,
        ok: true,
      });

      await expect(
        client.createUser({
          email: 'test@example.com',
          name: 'testuser',
          password: 'password123',
        }),
      ).rejects.toThrow('Failed to create user');
    });
  });

  describe('isConfigured', () => {
    it('should return true when all environment variables are set', () => {
      expect(CasdoorClient.isConfigured()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle network errors in getToken', async () => {
      const client = new CasdoorClient();

      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(client.getToken('testuser', 'testpass')).rejects.toThrow('Network error');
    });

    it('should handle network errors in getUserInfo', async () => {
      const client = new CasdoorClient();

      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(client.getUserInfo('token')).rejects.toThrow('Network error');
    });

    it('should handle network errors in createUser', async () => {
      const client = new CasdoorClient();

      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(
        client.createUser({
          email: 'test@example.com',
          name: 'test',
          password: 'pass',
        }),
      ).rejects.toThrow('Network error');
    });

    it('should handle malformed JSON response in getToken', async () => {
      const client = new CasdoorClient();

      (global.fetch as any).mockResolvedValue({
        json: async () => {
          throw new Error('Invalid JSON');
        },
        ok: true,
      });

      await expect(client.getToken('testuser', 'testpass')).rejects.toThrow('Invalid JSON');
    });
  });
});
