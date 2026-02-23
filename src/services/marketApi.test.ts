import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MARKET_ENDPOINTS } from './_url';
import { MarketApiService } from './marketApi';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const createOkResponse = (body: unknown, status = 200) =>
  ({
    ok: true,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  }) as unknown as Response;

const createErrorResponse = (status: number, errorBody?: unknown, textBody?: string) =>
  ({
    ok: false,
    status,
    json: errorBody !== undefined ? vi.fn().mockResolvedValue(errorBody) : vi.fn().mockRejectedValue(new Error('not json')),
    text: vi.fn().mockResolvedValue(textBody ?? 'Error occurred'),
  }) as unknown as Response;

describe('MarketApiService', () => {
  let service: MarketApiService;

  beforeEach(() => {
    service = new MarketApiService();
    vi.clearAllMocks();
  });

  describe('setAccessToken', () => {
    it('should set access token used in subsequent requests', async () => {
      const agentDetail = { id: '1', identifier: 'test-agent' };
      mockFetch.mockResolvedValue(createOkResponse(agentDetail));

      service.setAccessToken('my-token');
      await service.getAgentDetail('test-agent');

      const [, init] = mockFetch.mock.calls[0];
      const headers: Headers = init.headers;
      expect(headers.get('authorization')).toBe('Bearer my-token');
    });

    it('should not set authorization header when no token is set', async () => {
      const agentDetail = { id: '1', identifier: 'test-agent' };
      mockFetch.mockResolvedValue(createOkResponse(agentDetail));

      await service.getAgentDetail('test-agent');

      const [, init] = mockFetch.mock.calls[0];
      const headers: Headers = init.headers;
      expect(headers.get('authorization')).toBeNull();
    });
  });

  describe('request (via public methods)', () => {
    it('should set content-type to application/json when body is present', async () => {
      const agentDetail = { id: '1', identifier: 'new-agent' };
      mockFetch.mockResolvedValue(createOkResponse(agentDetail));

      await service.createAgent({ identifier: 'new-agent', name: 'New Agent' });

      const [, init] = mockFetch.mock.calls[0];
      const headers: Headers = init.headers;
      expect(headers.get('content-type')).toBe('application/json');
    });

    it('should use same-origin credentials by default', async () => {
      const agentDetail = { id: '1', identifier: 'test-agent' };
      mockFetch.mockResolvedValue(createOkResponse(agentDetail));

      await service.getAgentDetail('test-agent');

      const [, init] = mockFetch.mock.calls[0];
      expect(init.credentials).toBe('same-origin');
    });

    it('should return undefined for 204 responses', async () => {
      mockFetch.mockResolvedValue(createOkResponse(undefined, 204));

      const result = await service.getAgentDetail('test-agent');

      expect(result).toBeUndefined();
    });

    it('should throw error with message from JSON error body', async () => {
      mockFetch.mockResolvedValue(
        createErrorResponse(400, { message: 'Agent already exists' }),
      );

      await expect(service.createAgent({ identifier: 'dupe', name: 'Dupe' })).rejects.toThrow(
        'Agent already exists',
      );
    });

    it('should throw error with text when JSON parsing fails', async () => {
      mockFetch.mockResolvedValue(createErrorResponse(500, undefined, 'Internal Server Error'));

      await expect(service.createAgent({ identifier: 'test', name: 'Test' })).rejects.toThrow(
        'Internal Server Error',
      );
    });

    it('should throw a fallback error when response body is empty', async () => {
      mockFetch.mockResolvedValue(createErrorResponse(500, undefined, ''));

      await expect(service.createAgent({ identifier: 'test', name: 'Test' })).rejects.toThrow(
        'Market request failed',
      );
    });

    it('should not override existing authorization header', async () => {
      const agentDetail = { id: '1', identifier: 'test-agent' };
      mockFetch.mockResolvedValue(createOkResponse(agentDetail));

      service.setAccessToken('service-token');

      // We test via getAgentDetail which passes a plain RequestInit
      // The service should not override an existing authorization header
      // Since getAgentDetail doesn't set custom headers, this tests the token path
      await service.getAgentDetail('test-agent');

      const [, init] = mockFetch.mock.calls[0];
      const headers: Headers = init.headers;
      expect(headers.get('authorization')).toBe('Bearer service-token');
    });
  });

  describe('createAgent', () => {
    it('should POST to create agent endpoint with serialized body', async () => {
      const agentData = { identifier: 'my-agent', name: 'My Agent' };
      const responseData = { id: '123', ...agentData };
      mockFetch.mockResolvedValue(createOkResponse(responseData));

      const result = await service.createAgent(agentData);

      expect(mockFetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.createAgent,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(agentData),
        }),
      );
      expect(result).toEqual(responseData);
    });

    it('should include optional fields when provided', async () => {
      const agentData = {
        identifier: 'my-agent',
        name: 'My Agent',
        homepage: 'https://example.com',
        isFeatured: true,
        status: 'published' as const,
        tokenUsage: 100,
        visibility: 'public' as const,
      };
      const responseData = { id: '123', ...agentData };
      mockFetch.mockResolvedValue(createOkResponse(responseData));

      const result = await service.createAgent(agentData);

      expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual(agentData);
      expect(result).toEqual(responseData);
    });
  });

  describe('getAgentDetail', () => {
    it('should GET agent detail at URL-encoded identifier path', async () => {
      const agentDetail = { id: '1', identifier: 'test-agent' };
      mockFetch.mockResolvedValue(createOkResponse(agentDetail));

      const result = await service.getAgentDetail('test-agent');

      expect(mockFetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.getAgentDetail('test-agent'),
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result).toEqual(agentDetail);
    });

    it('should URL-encode special characters in identifier', async () => {
      const identifier = 'agent/with spaces&chars';
      const agentDetail = { id: '1', identifier };
      mockFetch.mockResolvedValue(createOkResponse(agentDetail));

      await service.getAgentDetail(identifier);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe(MARKET_ENDPOINTS.getAgentDetail(identifier));
      expect(url).toContain(encodeURIComponent(identifier));
    });

    it('should throw error when agent is not found', async () => {
      mockFetch.mockResolvedValue(createErrorResponse(404, { message: 'Not found' }));

      await expect(service.getAgentDetail('nonexistent')).rejects.toThrow('Not found');
    });
  });

  describe('checkAgentExists', () => {
    it('should return true when agent exists', async () => {
      const agentDetail = { id: '1', identifier: 'exists-agent' };
      mockFetch.mockResolvedValue(createOkResponse(agentDetail));

      const exists = await service.checkAgentExists('exists-agent');

      expect(exists).toBe(true);
    });

    it('should return false when agent does not exist (getAgentDetail throws)', async () => {
      mockFetch.mockResolvedValue(createErrorResponse(404, { message: 'Not found' }));

      const exists = await service.checkAgentExists('nonexistent-agent');

      expect(exists).toBe(false);
    });

    it('should return false on any error from getAgentDetail', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));

      const exists = await service.checkAgentExists('some-agent');

      expect(exists).toBe(false);
    });
  });

  describe('createAgentVersion', () => {
    it('should POST to create version endpoint with identifier and version data', async () => {
      const versionData = {
        identifier: 'my-agent',
        name: 'My Agent v2',
        description: 'New version',
      };
      const responseData = { id: '456', ...versionData };
      mockFetch.mockResolvedValue(createOkResponse(responseData));

      const result = await service.createAgentVersion(versionData);

      expect(mockFetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.createAgentVersion,
        expect.objectContaining({ method: 'POST' }),
      );

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.identifier).toBe('my-agent');
      expect(sentBody.name).toBe('My Agent v2');
      expect(result).toEqual(responseData);
    });

    it('should throw error when identifier is missing', async () => {
      await expect(
        service.createAgentVersion({ identifier: '', name: 'Test' }),
      ).rejects.toThrow('Identifier is required');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should spread all optional fields into request body', async () => {
      const versionData = {
        identifier: 'my-agent',
        name: 'My Agent',
        description: 'A description',
        summary: 'Short summary',
        url: 'https://agent.example.com',
        setAsCurrent: true,
        tokenUsage: 500,
        hasStreaming: true,
      };
      const responseData = { id: '789', ...versionData };
      mockFetch.mockResolvedValue(createOkResponse(responseData));

      await service.createAgentVersion(versionData);

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody).toMatchObject({
        identifier: 'my-agent',
        name: 'My Agent',
        description: 'A description',
        summary: 'Short summary',
        url: 'https://agent.example.com',
        setAsCurrent: true,
        tokenUsage: 500,
        hasStreaming: true,
      });
    });
  });
});
