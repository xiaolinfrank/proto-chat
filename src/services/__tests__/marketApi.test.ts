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
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(''),
    headers: new Headers({ 'content-type': 'application/json' }),
  }) as unknown as Response;

const mockErrorResponse = (status: number, errorBody?: unknown, textBody?: string) => {
  if (errorBody !== undefined) {
    return {
      ok: false,
      status,
      json: vi.fn().mockResolvedValue(errorBody),
      text: vi.fn().mockResolvedValue(''),
      headers: new Headers(),
    } as unknown as Response;
  }
  return {
    ok: false,
    status,
    json: vi.fn().mockRejectedValue(new SyntaxError('invalid json')),
    text: vi.fn().mockResolvedValue(textBody ?? 'Server error'),
    headers: new Headers(),
  } as unknown as Response;
};

describe('MarketApiService', () => {
  let service: MarketApiService;

  beforeEach(() => {
    service = new MarketApiService();
  });

  describe('setAccessToken', () => {
    it('should set the access token for subsequent requests', async () => {
      const token = 'my-access-token';
      service.setAccessToken(token);

      const agentDetail = { identifier: 'test-agent', name: 'Test' };
      (fetch as Mock).mockResolvedValue(mockSuccessResponse(agentDetail));

      await service.getAgentDetail('test-agent');

      const [, init] = (fetch as Mock).mock.calls[0];
      expect(init.headers.get('authorization')).toBe(`Bearer ${token}`);
    });

    it('should not set authorization header if no token is set', async () => {
      const agentDetail = { identifier: 'test-agent', name: 'Test' };
      (fetch as Mock).mockResolvedValue(mockSuccessResponse(agentDetail));

      await service.getAgentDetail('test-agent');

      const [, init] = (fetch as Mock).mock.calls[0];
      expect(init.headers.get('authorization')).toBeNull();
    });
  });

  describe('request (via public methods)', () => {
    it('should set content-type to application/json when body is provided', async () => {
      (fetch as Mock).mockResolvedValue(mockSuccessResponse({ identifier: 'abc', name: 'A' }));

      await service.createAgent({ identifier: 'abc', name: 'A' });

      const [, init] = (fetch as Mock).mock.calls[0];
      expect(init.headers.get('content-type')).toBe('application/json');
    });

    it('should throw error with message from JSON error body', async () => {
      (fetch as Mock).mockResolvedValue(
        mockErrorResponse(400, { message: 'Agent already exists' }),
      );

      await expect(service.createAgent({ identifier: 'abc', name: 'A' })).rejects.toThrow(
        'Agent already exists',
      );
    });

    it('should throw error with text body when JSON parsing fails', async () => {
      (fetch as Mock).mockResolvedValue(mockErrorResponse(500, undefined, 'Internal Server Error'));

      await expect(service.getAgentDetail('abc')).rejects.toThrow('Internal Server Error');
    });

    it('should throw error with "Market request failed" when body is empty', async () => {
      (fetch as Mock).mockResolvedValue(mockErrorResponse(500, undefined, ''));

      await expect(service.getAgentDetail('abc')).rejects.toThrow('Market request failed');
    });

    it('should use "Unknown error" when error body has no message field', async () => {
      (fetch as Mock).mockResolvedValue(mockErrorResponse(400, { code: 'BAD_REQUEST' }));

      await expect(service.createAgent({ identifier: 'abc', name: 'A' })).rejects.toThrow(
        'Unknown error',
      );
    });

    it('should return undefined for 204 No Content responses', async () => {
      (fetch as Mock).mockResolvedValue({
        ok: true,
        status: 204,
        json: vi.fn(),
        text: vi.fn(),
        headers: new Headers(),
      });

      const result = await service.createAgent({ identifier: 'abc', name: 'A' });
      expect(result).toBeUndefined();
    });

    it('should use same-origin credentials by default', async () => {
      (fetch as Mock).mockResolvedValue(mockSuccessResponse({ identifier: 'abc', name: 'A' }));

      await service.getAgentDetail('abc');

      const [, init] = (fetch as Mock).mock.calls[0];
      expect(init.credentials).toBe('same-origin');
    });
  });

  describe('createAgent', () => {
    it('should POST to the createAgent endpoint with agent data', async () => {
      const agentData = { identifier: 'my-agent', name: 'My Agent' };
      const mockResult = { ...agentData, id: 1 };
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

    it('should include optional fields when provided', async () => {
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

      const [, init] = (fetch as Mock).mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body).toMatchObject({
        identifier: 'my-agent',
        name: 'My Agent',
        homepage: 'https://example.com',
        isFeatured: true,
      });
    });
  });

  describe('getAgentDetail', () => {
    it('should GET from the agent detail endpoint', async () => {
      const identifier = 'test-agent';
      const agentDetail = { identifier, name: 'Test Agent' };
      (fetch as Mock).mockResolvedValue(mockSuccessResponse(agentDetail));

      const result = await service.getAgentDetail(identifier);

      expect(fetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.getAgentDetail(identifier),
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result).toEqual(agentDetail);
    });

    it('should URL-encode special characters in identifier', async () => {
      const identifier = 'agent/with/slashes';
      (fetch as Mock).mockResolvedValue(mockSuccessResponse({ identifier, name: 'Test' }));

      await service.getAgentDetail(identifier);

      const [url] = (fetch as Mock).mock.calls[0];
      expect(url).toBe(`/market/agent/${encodeURIComponent(identifier)}`);
    });
  });

  describe('checkAgentExists', () => {
    it('should return true when getAgentDetail succeeds', async () => {
      (fetch as Mock).mockResolvedValue(
        mockSuccessResponse({ identifier: 'my-agent', name: 'My Agent' }),
      );

      const exists = await service.checkAgentExists('my-agent');
      expect(exists).toBe(true);
    });

    it('should return false when getAgentDetail throws', async () => {
      (fetch as Mock).mockResolvedValue(mockErrorResponse(404, { message: 'Not found' }));

      const exists = await service.checkAgentExists('non-existent-agent');
      expect(exists).toBe(false);
    });

    it('should return false on network error', async () => {
      (fetch as Mock).mockRejectedValue(new Error('Network error'));

      const exists = await service.checkAgentExists('my-agent');
      expect(exists).toBe(false);
    });
  });

  describe('createAgentVersion', () => {
    it('should POST to createAgentVersion endpoint with version data', async () => {
      const versionData = {
        identifier: 'my-agent',
        name: 'My Agent v2',
        description: 'Version 2',
        url: 'https://example.com/agent',
      };
      const mockResult = { ...versionData, id: 10 };
      (fetch as Mock).mockResolvedValue(mockSuccessResponse(mockResult));

      const result = await service.createAgentVersion(versionData);

      expect(fetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.createAgentVersion,
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw error when identifier is missing', async () => {
      await expect(
        service.createAgentVersion({ identifier: '', name: 'My Agent' }),
      ).rejects.toThrow('Identifier is required');

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should separate identifier into body payload correctly', async () => {
      const versionData = {
        identifier: 'my-agent',
        name: 'Version 1',
        description: 'First version',
        setAsCurrent: true,
      };
      (fetch as Mock).mockResolvedValue(mockSuccessResponse({}));

      await service.createAgentVersion(versionData);

      const [, init] = (fetch as Mock).mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.identifier).toBe('my-agent');
      expect(body.name).toBe('Version 1');
      expect(body.setAsCurrent).toBe(true);
    });

    it('should include optional version metadata when provided', async () => {
      const versionData = {
        identifier: 'my-agent',
        hasStreaming: true,
        tokenUsage: 500,
        category: 'productivity',
        changelog: 'Initial release',
      };
      (fetch as Mock).mockResolvedValue(mockSuccessResponse({}));

      await service.createAgentVersion(versionData);

      const [, init] = (fetch as Mock).mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.hasStreaming).toBe(true);
      expect(body.tokenUsage).toBe(500);
      expect(body.category).toBe('productivity');
    });
  });

  describe('marketApiService singleton', () => {
    it('should be an instance of MarketApiService', () => {
      expect(marketApiService).toBeInstanceOf(MarketApiService);
    });
  });
});
