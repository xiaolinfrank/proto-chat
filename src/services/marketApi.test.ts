import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MARKET_ENDPOINTS } from '@/services/_url';

import { MarketApiService } from './marketApi';

describe('MarketApiService', () => {
  let service: MarketApiService;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new MarketApiService();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    vi.clearAllMocks();
  });

  describe('setAccessToken', () => {
    it('should set the access token', () => {
      const token = 'test-token-123';
      service.setAccessToken(token);
      expect(service['accessToken']).toBe(token);
    });
  });

  describe('request', () => {
    it('should make a successful GET request', async () => {
      const mockData = { id: '1', name: 'test' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce(mockData),
      });

      const result = await service['request']('/test-endpoint', { method: 'GET' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/test-endpoint',
        expect.objectContaining({
          method: 'GET',
          credentials: 'same-origin',
        }),
      );
      expect(result).toEqual(mockData);
    });

    it('should set content-type header when body is present', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({}),
      });

      await service['request']('/test-endpoint', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
      });

      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders.get('content-type')).toBe('application/json');
    });

    it('should not override existing content-type header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({}),
      });

      const customHeaders = new Headers();
      customHeaders.set('content-type', 'text/plain');

      await service['request']('/test-endpoint', {
        method: 'POST',
        body: 'plain text',
        headers: customHeaders,
      });

      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders.get('content-type')).toBe('text/plain');
    });

    it('should add authorization header when access token is set', async () => {
      const token = 'test-bearer-token';
      service.setAccessToken(token);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({}),
      });

      await service['request']('/test-endpoint', { method: 'GET' });

      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders.get('authorization')).toBe(`Bearer ${token}`);
    });

    it('should not override existing authorization header', async () => {
      service.setAccessToken('default-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({}),
      });

      const customHeaders = new Headers();
      customHeaders.set('authorization', 'Bearer custom-token');

      await service['request']('/test-endpoint', {
        method: 'GET',
        headers: customHeaders,
      });

      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders.get('authorization')).toBe('Bearer custom-token');
    });

    it('should handle 204 No Content response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await service['request']('/test-endpoint', { method: 'DELETE' });

      expect(result).toBeUndefined();
    });

    it('should throw error with JSON error message on failed request', async () => {
      const errorMessage = 'Invalid request';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValueOnce({ message: errorMessage }),
        text: vi.fn(),
      });

      await expect(service['request']('/test-endpoint', { method: 'GET' })).rejects.toThrow(
        errorMessage,
      );
    });

    it('should throw error with text message when JSON parsing fails', async () => {
      const textError = 'Text error message';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValueOnce(new Error('JSON parse error')),
        text: vi.fn().mockResolvedValueOnce(textError),
      });

      await expect(service['request']('/test-endpoint', { method: 'GET' })).rejects.toThrow(
        textError,
      );
    });

    it('should throw generic error message when error body is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValueOnce(new Error('JSON parse error')),
        text: vi.fn().mockResolvedValueOnce(''),
      });

      await expect(service['request']('/test-endpoint', { method: 'GET' })).rejects.toThrow(
        'Market request failed',
      );
    });

    it('should use provided credentials option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({}),
      });

      await service['request']('/test-endpoint', {
        method: 'GET',
        credentials: 'include',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/test-endpoint',
        expect.objectContaining({
          credentials: 'include',
        }),
      );
    });
  });

  describe('createAgent', () => {
    it('should create agent with required fields', async () => {
      const agentData = {
        identifier: 'test-agent',
        name: 'Test Agent',
      };

      const mockResponse = { id: '123', ...agentData };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await service.createAgent(agentData);

      expect(mockFetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.createAgent,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(agentData),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should create agent with all optional fields', async () => {
      const agentData = {
        identifier: 'test-agent',
        name: 'Test Agent',
        homepage: 'https://example.com',
        isFeatured: true,
        status: 'published' as const,
        tokenUsage: 1000,
        visibility: 'public' as const,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({ id: '123' }),
      });

      await service.createAgent(agentData);

      expect(mockFetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.createAgent,
        expect.objectContaining({
          body: JSON.stringify(agentData),
        }),
      );
    });
  });

  describe('getAgentDetail', () => {
    it('should get agent detail by identifier', async () => {
      const identifier = 'test-agent';
      const mockResponse = { id: '123', identifier, name: 'Test Agent' };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await service.getAgentDetail(identifier);

      expect(mockFetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.getAgentDetail(identifier),
        expect.objectContaining({
          method: 'GET',
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle special characters in identifier', async () => {
      const identifier = 'test-agent@v1.0';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({ id: '123' }),
      });

      await service.getAgentDetail(identifier);

      expect(mockFetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.getAgentDetail(identifier),
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });
  });

  describe('checkAgentExists', () => {
    it('should return true if agent exists', async () => {
      const identifier = 'existing-agent';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({ id: '123', identifier }),
      });

      const result = await service.checkAgentExists(identifier);

      expect(result).toBe(true);
    });

    it('should return false if agent does not exist', async () => {
      const identifier = 'non-existing-agent';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValueOnce({ message: 'Not found' }),
      });

      const result = await service.checkAgentExists(identifier);

      expect(result).toBe(false);
    });

    it('should return false on any error', async () => {
      const identifier = 'error-agent';
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.checkAgentExists(identifier);

      expect(result).toBe(false);
    });
  });

  describe('createAgentVersion', () => {
    it('should create agent version with required fields', async () => {
      const versionData = {
        identifier: 'test-agent',
      };

      const mockResponse = { id: '456', versionNumber: '1.0.0' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await service.createAgentVersion(versionData);

      expect(mockFetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.createAgentVersion,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ identifier: 'test-agent' }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error when identifier is missing', async () => {
      const versionData = {
        identifier: '',
      };

      await expect(service.createAgentVersion(versionData)).rejects.toThrow(
        'Identifier is required',
      );
    });

    it('should create agent version with all optional fields', async () => {
      const versionData = {
        identifier: 'test-agent',
        a2aProtocolVersion: '1.0',
        avatar: 'https://example.com/avatar.png',
        category: 'productivity',
        changelog: 'Initial release',
        config: { theme: 'dark' },
        defaultInputModes: ['text', 'voice'],
        defaultOutputModes: ['text'],
        description: 'A test agent',
        documentationUrl: 'https://docs.example.com',
        extensions: [{ name: 'ext1' }],
        hasPushNotifications: true,
        hasStateTransitionHistory: false,
        hasStreaming: true,
        interfaces: [{ type: 'chat' }],
        name: 'Test Agent v1',
        preferredTransport: 'websocket',
        providerId: 42,
        securityRequirements: [{ oauth: ['read'] }],
        securitySchemes: { oauth: { type: 'oauth2' } },
        setAsCurrent: true,
        summary: 'Test summary',
        supportsAuthenticatedExtendedCard: true,
        tokenUsage: 5000,
        url: 'https://agent.example.com',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({ id: '456' }),
      });

      await service.createAgentVersion(versionData);

      const expectedBody = { ...versionData };

      expect(mockFetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.createAgentVersion,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(expectedBody),
        }),
      );
    });

    it('should handle version data with complex nested objects', async () => {
      const versionData = {
        identifier: 'test-agent',
        config: {
          nested: {
            deeply: {
              value: 'test',
            },
          },
        },
        extensions: [
          {
            id: 'ext1',
            settings: {
              enabled: true,
              options: ['a', 'b', 'c'],
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce({ id: '456' }),
      });

      await service.createAgentVersion(versionData);

      expect(mockFetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.createAgentVersion,
        expect.objectContaining({
          body: JSON.stringify(versionData),
        }),
      );
    });
  });
});
