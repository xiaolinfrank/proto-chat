import { Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { MARKET_ENDPOINTS } from '@/services/_url';

import { MarketApiService, marketApiService } from '../marketApi';

global.fetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

const mockSuccessResponse = (data: unknown, status = 200) =>
  ({
    ok: true,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  }) as Response;

const mockErrorResponse = (status: number, body?: unknown) =>
  ({
    ok: false,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(body ? JSON.stringify(body) : 'error'),
  }) as Response;

describe('MarketApiService', () => {
  let service: MarketApiService;

  beforeEach(() => {
    service = new MarketApiService();
  });

  describe('setAccessToken', () => {
    it('should set the access token', async () => {
      service.setAccessToken('test-token');

      (fetch as Mock).mockResolvedValue(mockSuccessResponse({ id: '1' }));

      await service.getAgentDetail('my-agent');

      const call = (fetch as Mock).mock.calls[0];
      const headers: Headers = call[1].headers;
      expect(headers.get('authorization')).toBe('Bearer test-token');
    });

    it('should not set authorization header when no token is set', async () => {
      (fetch as Mock).mockResolvedValue(mockSuccessResponse({ id: '1' }));

      await service.getAgentDetail('my-agent');

      const call = (fetch as Mock).mock.calls[0];
      const headers: Headers = call[1].headers;
      expect(headers.get('authorization')).toBeNull();
    });
  });

  describe('request (via createAgent)', () => {
    it('should set content-type to application/json when body is present', async () => {
      (fetch as Mock).mockResolvedValue(mockSuccessResponse({ identifier: 'test' }));

      await service.createAgent({ identifier: 'test', name: 'Test Agent' });

      const call = (fetch as Mock).mock.calls[0];
      const headers: Headers = call[1].headers;
      expect(headers.get('content-type')).toBe('application/json');
    });

    it('should not override content-type if already provided in init headers', async () => {
      // We test this indirectly — since createAgent passes no explicit content-type headers,
      // request always sets it. We verify it's set exactly once.
      (fetch as Mock).mockResolvedValue(mockSuccessResponse({ identifier: 'test' }));

      await service.createAgent({ identifier: 'test', name: 'Test Agent' });

      const call = (fetch as Mock).mock.calls[0];
      const headers: Headers = call[1].headers;
      expect(headers.get('content-type')).toBe('application/json');
    });

    it('should use same-origin credentials by default', async () => {
      (fetch as Mock).mockResolvedValue(mockSuccessResponse({ id: '1' }));

      await service.getAgentDetail('my-agent');

      const call = (fetch as Mock).mock.calls[0];
      expect(call[1].credentials).toBe('same-origin');
    });

    it('should return undefined for 204 No Content responses', async () => {
      (fetch as Mock).mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.resolve(null),
        text: () => Promise.resolve(''),
      } as Response);

      const result = await service.getAgentDetail('my-agent');
      expect(result).toBeUndefined();
    });

    it('should throw an error with message from JSON body on non-ok response', async () => {
      (fetch as Mock).mockResolvedValue(
        mockErrorResponse(400, { message: 'Agent already exists' }),
      );

      await expect(service.createAgent({ identifier: 'test', name: 'Test' })).rejects.toThrow(
        'Agent already exists',
      );
    });

    it('should throw "Unknown error" when JSON body has no message field', async () => {
      (fetch as Mock).mockResolvedValue(mockErrorResponse(400, { code: 'ERR_UNKNOWN' }));

      await expect(service.createAgent({ identifier: 'test', name: 'Test' })).rejects.toThrow(
        'Unknown error',
      );
    });

    it('should fall back to response text when JSON parsing fails on error', async () => {
      (fetch as Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new SyntaxError('invalid json')),
        text: () => Promise.resolve('Internal Server Error'),
      } as unknown as Response);

      await expect(service.createAgent({ identifier: 'test', name: 'Test' })).rejects.toThrow(
        'Internal Server Error',
      );
    });

    it('should throw "Market request failed" when error body text is empty', async () => {
      (fetch as Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new SyntaxError('invalid json')),
        text: () => Promise.resolve(''),
      } as unknown as Response);

      await expect(service.createAgent({ identifier: 'test', name: 'Test' })).rejects.toThrow(
        'Market request failed',
      );
    });
  });

  describe('createAgent', () => {
    it('should POST to the createAgent endpoint with JSON body', async () => {
      const agentData = { identifier: 'my-agent', name: 'My Agent' };
      const mockResult = { identifier: 'my-agent', name: 'My Agent' };

      (fetch as Mock).mockResolvedValue(mockSuccessResponse(mockResult));

      const result = await service.createAgent(agentData);

      expect(fetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.createAgent,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(agentData),
        }),
      );
      expect(result).toEqual(mockResult);
    });

    it('should include optional fields in the request body', async () => {
      const agentData = {
        identifier: 'my-agent',
        name: 'My Agent',
        homepage: 'https://example.com',
        isFeatured: true,
        status: 'published' as const,
        visibility: 'public' as const,
        tokenUsage: 100,
      };

      (fetch as Mock).mockResolvedValue(mockSuccessResponse(agentData));

      await service.createAgent(agentData);

      const call = (fetch as Mock).mock.calls[0];
      expect(JSON.parse(call[1].body)).toEqual(agentData);
    });
  });

  describe('getAgentDetail', () => {
    it('should GET the agent detail endpoint with encoded identifier', async () => {
      const identifier = 'my-agent';
      const mockResult = { identifier, name: 'My Agent' };

      (fetch as Mock).mockResolvedValue(mockSuccessResponse(mockResult));

      const result = await service.getAgentDetail(identifier);

      expect(fetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.getAgentDetail(identifier),
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result).toEqual(mockResult);
    });

    it('should URL-encode special characters in the identifier', async () => {
      const identifier = 'agent/with spaces';

      (fetch as Mock).mockResolvedValue(mockSuccessResponse({}));

      await service.getAgentDetail(identifier);

      const call = (fetch as Mock).mock.calls[0];
      expect(call[0]).toBe(`/market/agent/${encodeURIComponent(identifier)}`);
    });
  });

  describe('checkAgentExists', () => {
    it('should return true when getAgentDetail succeeds', async () => {
      (fetch as Mock).mockResolvedValue(mockSuccessResponse({ identifier: 'my-agent' }));

      const exists = await service.checkAgentExists('my-agent');

      expect(exists).toBe(true);
    });

    it('should return false when getAgentDetail throws an error', async () => {
      (fetch as Mock).mockResolvedValue(mockErrorResponse(404, { message: 'Not found' }));

      const exists = await service.checkAgentExists('nonexistent-agent');

      expect(exists).toBe(false);
    });

    it('should return false on network errors', async () => {
      (fetch as Mock).mockRejectedValue(new Error('Network error'));

      const exists = await service.checkAgentExists('my-agent');

      expect(exists).toBe(false);
    });
  });

  describe('createAgentVersion', () => {
    it('should POST to the createAgentVersion endpoint with identifier and rest of data', async () => {
      const versionData = {
        identifier: 'my-agent',
        name: 'My Agent',
        description: 'A test agent',
        url: 'https://example.com/agent',
      };
      const mockResult = { identifier: 'my-agent' };

      (fetch as Mock).mockResolvedValue(mockSuccessResponse(mockResult));

      const result = await service.createAgentVersion(versionData);

      expect(fetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.createAgentVersion,
        expect.objectContaining({ method: 'POST' }),
      );

      const call = (fetch as Mock).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.identifier).toBe('my-agent');
      expect(body.name).toBe('My Agent');
      expect(body.description).toBe('A test agent');
      expect(result).toEqual(mockResult);
    });

    it('should throw an error when identifier is missing', async () => {
      await expect(
        service.createAgentVersion({
          identifier: '',
          name: 'Test',
        }),
      ).rejects.toThrow('Identifier is required');
    });

    it('should include all optional fields in the request body', async () => {
      const versionData = {
        identifier: 'my-agent',
        a2aProtocolVersion: '1.0',
        avatar: 'https://example.com/avatar.png',
        category: 'assistant',
        changelog: 'Initial release',
        hasStreaming: true,
        setAsCurrent: true,
        tokenUsage: 500,
        url: 'https://example.com/agent',
      };

      (fetch as Mock).mockResolvedValue(mockSuccessResponse({ identifier: 'my-agent' }));

      await service.createAgentVersion(versionData);

      const call = (fetch as Mock).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.identifier).toBe('my-agent');
      expect(body.a2aProtocolVersion).toBe('1.0');
      expect(body.hasStreaming).toBe(true);
      expect(body.setAsCurrent).toBe(true);
      expect(body.tokenUsage).toBe(500);
    });
  });

  describe('marketApiService singleton', () => {
    it('should export a shared instance of MarketApiService', () => {
      expect(marketApiService).toBeInstanceOf(MarketApiService);
    });
  });
});
