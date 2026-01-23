import { describe, it, expect, vi, beforeEach } from 'vitest';

import { MARKET_ENDPOINTS } from '@/services/_url';

import { MarketApiService, marketApiService } from './marketApi';

describe('MarketApiService', () => {
  let service: MarketApiService;

  beforeEach(() => {
    service = new MarketApiService();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('request', () => {
    it('should set content-type header when body is provided', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
        status: 200,
      } as Response);

      await service['request']('/test', {
        body: JSON.stringify({ test: 'data' }),
        method: 'POST',
      });

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const headers = fetchCall[1]?.headers as Headers;
      expect(headers.get('content-type')).toBe('application/json');
    });

    it('should set authorization header when access token is set', async () => {
      const token = 'test-token-123';
      service.setAccessToken(token);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
        status: 200,
      } as Response);

      await service['request']('/test', { method: 'GET' });

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const headers = fetchCall[1]?.headers as Headers;
      expect(headers.get('authorization')).toBe(`Bearer ${token}`);
    });

    it('should not override existing content-type header', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
        status: 200,
      } as Response);

      await service['request']('/test', {
        body: JSON.stringify({ test: 'data' }),
        headers: { 'content-type': 'application/custom' },
        method: 'POST',
      });

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const headers = fetchCall[1]?.headers as Headers;
      expect(headers.get('content-type')).toBe('application/custom');
    });

    it('should not override existing authorization header', async () => {
      service.setAccessToken('default-token');

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
        status: 200,
      } as Response);

      await service['request']('/test', {
        headers: { authorization: 'Bearer custom-token' },
        method: 'GET',
      });

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const headers = fetchCall[1]?.headers as Headers;
      expect(headers.get('authorization')).toBe('Bearer custom-token');
    });

    it('should set credentials to same-origin by default', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
        status: 200,
      } as Response);

      await service['request']('/test', { method: 'GET' });

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      expect(fetchCall[1]?.credentials).toBe('same-origin');
    });

    it('should respect custom credentials setting', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
        status: 200,
      } as Response);

      await service['request']('/test', {
        credentials: 'include',
        method: 'GET',
      });

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      expect(fetchCall[1]?.credentials).toBe('include');
    });

    it('should return undefined for 204 status', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 204,
      } as Response);

      const result = await service['request']('/test', { method: 'DELETE' });

      expect(result).toBeUndefined();
    });

    it('should return JSON data for successful responses', async () => {
      const mockData = { id: '123', name: 'Test Agent' };
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockData,
        status: 200,
      } as Response);

      const result = await service['request']('/test', { method: 'GET' });

      expect(result).toEqual(mockData);
    });

    it('should throw error with JSON message when response is not ok', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Agent not found' }),
        status: 404,
      } as Response);

      await expect(service['request']('/test', { method: 'GET' })).rejects.toThrow(
        'Agent not found',
      );
    });

    it('should throw error with text message when JSON parsing fails', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error('Invalid JSON');
        },
        text: async () => 'Internal Server Error',
        status: 500,
      } as unknown as Response);

      await expect(service['request']('/test', { method: 'GET' })).rejects.toThrow(
        'Internal Server Error',
      );
    });

    it('should throw default error message when no error body available', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error('Invalid JSON');
        },
        text: async () => '',
        status: 500,
      } as unknown as Response);

      await expect(service['request']('/test', { method: 'GET' })).rejects.toThrow(
        'Market request failed',
      );
    });

    it('should handle error response with null message', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        json: async () => ({ message: null }),
        status: 400,
      } as Response);

      await expect(service['request']('/test', { method: 'GET' })).rejects.toThrow(
        'Unknown error',
      );
    });
  });

  describe('setAccessToken', () => {
    it('should set access token', () => {
      const token = 'new-token-456';
      service.setAccessToken(token);

      // Verify token is set by checking if it's used in requests
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
        status: 200,
      } as Response);

      service['request']('/test', { method: 'GET' });

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const headers = fetchCall[1]?.headers as Headers;
      expect(headers.get('authorization')).toBe(`Bearer ${token}`);
    });
  });

  describe('createAgent', () => {
    it('should create agent with required fields', async () => {
      const agentData = {
        identifier: 'test-agent',
        name: 'Test Agent',
      };

      const mockResponse = {
        id: 'agent-123',
        ...agentData,
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        status: 200,
      } as Response);

      const result = await service.createAgent(agentData);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.createAgent,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(agentData),
        }),
      );
    });

    it('should create agent with optional fields', async () => {
      const agentData = {
        homepage: 'https://example.com',
        identifier: 'test-agent',
        isFeatured: true,
        name: 'Test Agent',
        status: 'published' as const,
        tokenUsage: 1000,
        visibility: 'public' as const,
      };

      const mockResponse = {
        id: 'agent-123',
        ...agentData,
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        status: 200,
      } as Response);

      const result = await service.createAgent(agentData);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.createAgent,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(agentData),
        }),
      );
    });
  });

  describe('getAgentDetail', () => {
    it('should get agent detail by identifier', async () => {
      const identifier = 'test-agent';
      const mockAgent = {
        id: 'agent-123',
        identifier,
        name: 'Test Agent',
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockAgent,
        status: 200,
      } as Response);

      const result = await service.getAgentDetail(identifier);

      expect(result).toEqual(mockAgent);
      expect(global.fetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.getAgentDetail(identifier),
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });

    it('should encode identifier in URL', async () => {
      const identifier = 'test agent with spaces';
      const mockAgent = {
        id: 'agent-123',
        identifier,
        name: 'Test Agent',
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockAgent,
        status: 200,
      } as Response);

      await service.getAgentDetail(identifier);

      expect(global.fetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.getAgentDetail(identifier),
        expect.objectContaining({
          method: 'GET',
        }),
      );
    });

    it('should throw error when agent not found', async () => {
      const identifier = 'nonexistent-agent';

      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Agent not found' }),
        status: 404,
      } as Response);

      await expect(service.getAgentDetail(identifier)).rejects.toThrow('Agent not found');
    });
  });

  describe('checkAgentExists', () => {
    it('should return true when agent exists', async () => {
      const identifier = 'existing-agent';

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'agent-123', identifier }),
        status: 200,
      } as Response);

      const result = await service.checkAgentExists(identifier);

      expect(result).toBe(true);
    });

    it('should return false when agent does not exist', async () => {
      const identifier = 'nonexistent-agent';

      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Agent not found' }),
        status: 404,
      } as Response);

      const result = await service.checkAgentExists(identifier);

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      const identifier = 'test-agent';

      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      const result = await service.checkAgentExists(identifier);

      expect(result).toBe(false);
    });
  });

  describe('createAgentVersion', () => {
    it('should create agent version with required fields', async () => {
      const versionData = {
        identifier: 'test-agent',
      };

      const mockResponse = {
        id: 'version-123',
        identifier: 'test-agent',
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        status: 200,
      } as Response);

      const result = await service.createAgentVersion(versionData);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.createAgentVersion,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(versionData),
        }),
      );
    });

    it('should create agent version with all optional fields', async () => {
      const versionData = {
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
        hasStateTransitionHistory: true,
        hasStreaming: true,
        identifier: 'test-agent',
        interfaces: [{ name: 'chat' }],
        name: 'Test Agent',
        preferredTransport: 'http',
        providerId: 1,
        securityRequirements: [{ name: 'auth' }],
        securitySchemes: { bearer: {} },
        setAsCurrent: true,
        summary: 'A summary',
        supportsAuthenticatedExtendedCard: true,
        tokenUsage: 1000,
        url: 'https://example.com',
      };

      const mockResponse = {
        id: 'version-123',
        ...versionData,
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
        status: 200,
      } as Response);

      const result = await service.createAgentVersion(versionData);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.createAgentVersion,
        expect.objectContaining({
          method: 'POST',
        }),
      );
      // Verify the body contains all fields
      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body).toMatchObject(versionData);
    });

    it('should throw error when identifier is missing', async () => {
      const versionData = {
        identifier: '',
      };

      await expect(service.createAgentVersion(versionData)).rejects.toThrow(
        'Identifier is required',
      );
    });

    it('should throw error when identifier is undefined', async () => {
      const versionData = {
        identifier: undefined as any,
      };

      await expect(service.createAgentVersion(versionData)).rejects.toThrow(
        'Identifier is required',
      );
    });
  });

  describe('marketApiService singleton', () => {
    it('should export singleton instance', () => {
      expect(marketApiService).toBeInstanceOf(MarketApiService);
    });

    it('should maintain state across calls', () => {
      const token = 'singleton-token';
      marketApiService.setAccessToken(token);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
        status: 200,
      } as Response);

      marketApiService['request']('/test', { method: 'GET' });

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const headers = fetchCall[1]?.headers as Headers;
      expect(headers.get('authorization')).toBe(`Bearer ${token}`);
    });
  });
});
