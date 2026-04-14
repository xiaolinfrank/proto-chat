import { Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { MARKET_ENDPOINTS } from '@/services/_url';

import { MarketApiService } from '../marketApi';

global.fetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

const mockOkResponse = (data: unknown, status = 200) =>
  ({
    ok: true,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(String(data)),
  }) as unknown as Response;

const mockErrorResponse = (status: number, body?: unknown, text?: string) =>
  ({
    ok: false,
    status,
    json: body !== undefined ? () => Promise.resolve(body) : () => Promise.reject(new SyntaxError('not json')),
    text: () => Promise.resolve(text ?? ''),
  }) as unknown as Response;

describe('MarketApiService', () => {
  let service: MarketApiService;

  beforeEach(() => {
    service = new MarketApiService();
  });

  describe('setAccessToken', () => {
    it('should store the token and include it in subsequent requests', async () => {
      service.setAccessToken('my-token');

      (fetch as Mock).mockResolvedValue(mockOkResponse({ identifier: 'test-agent' }));

      await service.getAgentDetail('test-agent');

      const [, init] = (fetch as Mock).mock.calls[0] as [string, RequestInit];
      expect((init.headers as Headers).get('authorization')).toBe('Bearer my-token');
    });

    it('should not add authorization header when no token is set', async () => {
      (fetch as Mock).mockResolvedValue(mockOkResponse({ identifier: 'test-agent' }));

      await service.getAgentDetail('test-agent');

      const [, init] = (fetch as Mock).mock.calls[0] as [string, RequestInit];
      expect((init.headers as Headers).has('authorization')).toBe(false);
    });
  });

  describe('request (via public methods)', () => {
    it('should set content-type to application/json when body is present', async () => {
      (fetch as Mock).mockResolvedValue(mockOkResponse({ identifier: 'new-agent' }));

      await service.createAgent({ identifier: 'new-agent', name: 'New Agent' });

      const [, init] = (fetch as Mock).mock.calls[0] as [string, RequestInit];
      expect((init.headers as Headers).get('content-type')).toBe('application/json');
    });

    it('should not override explicit content-type header', async () => {
      // Access private request via a subclass
      const customService = new (class extends MarketApiService {
        async customRequest() {
          return (this as any).request(MARKET_ENDPOINTS.createAgent, {
            body: '{}',
            headers: new Headers({ 'content-type': 'text/plain' }),
            method: 'POST',
          });
        }
      })();

      (fetch as Mock).mockResolvedValue(mockOkResponse({ identifier: 'agent' }));
      await customService.customRequest();

      const [, init] = (fetch as Mock).mock.calls[0] as [string, RequestInit];
      expect((init.headers as Headers).get('content-type')).toBe('text/plain');
    });

    it('should return undefined for 204 No Content responses', async () => {
      (fetch as Mock).mockResolvedValue(mockOkResponse(undefined, 204));

      const result = await service.getAgentDetail('agent-id');
      expect(result).toBeUndefined();
    });

    it('should throw error with JSON message when response is not ok', async () => {
      (fetch as Mock).mockResolvedValue(
        mockErrorResponse(400, { message: 'Agent not found' }),
      );

      await expect(service.getAgentDetail('missing')).rejects.toThrow('Agent not found');
    });

    it('should throw error with text body when response JSON parsing fails', async () => {
      (fetch as Mock).mockResolvedValue(mockErrorResponse(500, undefined, 'Internal Server Error'));

      await expect(service.getAgentDetail('agent-id')).rejects.toThrow('Internal Server Error');
    });

    it('should throw generic error when both JSON and text body are empty', async () => {
      (fetch as Mock).mockResolvedValue(mockErrorResponse(500, undefined, ''));

      await expect(service.getAgentDetail('agent-id')).rejects.toThrow('Market request failed');
    });

    it('should use same-origin credentials by default', async () => {
      (fetch as Mock).mockResolvedValue(mockOkResponse({ identifier: 'agent' }));

      await service.getAgentDetail('agent');

      const [, init] = (fetch as Mock).mock.calls[0] as [string, RequestInit];
      expect(init.credentials).toBe('same-origin');
    });
  });

  describe('createAgent', () => {
    it('should POST to createAgent endpoint with agent data', async () => {
      const mockAgent = { identifier: 'my-agent', name: 'My Agent' };
      (fetch as Mock).mockResolvedValue(mockOkResponse(mockAgent));

      const result = await service.createAgent({ identifier: 'my-agent', name: 'My Agent' });

      expect(fetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.createAgent,
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result).toEqual(mockAgent);
    });

    it('should serialize optional fields in request body', async () => {
      (fetch as Mock).mockResolvedValue(mockOkResponse({ identifier: 'agent' }));

      await service.createAgent({
        identifier: 'agent',
        name: 'Agent',
        homepage: 'https://example.com',
        isFeatured: true,
        status: 'published',
        visibility: 'public',
        tokenUsage: 100,
      });

      const [, init] = (fetch as Mock).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body).toMatchObject({
        identifier: 'agent',
        name: 'Agent',
        homepage: 'https://example.com',
        isFeatured: true,
        status: 'published',
        visibility: 'public',
        tokenUsage: 100,
      });
    });
  });

  describe('getAgentDetail', () => {
    it('should GET the correct endpoint for the given identifier', async () => {
      const identifier = 'my-agent';
      const mockDetail = { identifier };
      (fetch as Mock).mockResolvedValue(mockOkResponse(mockDetail));

      const result = await service.getAgentDetail(identifier);

      expect(fetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.getAgentDetail(identifier),
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result).toEqual(mockDetail);
    });

    it('should URL-encode special characters in identifier', async () => {
      (fetch as Mock).mockResolvedValue(mockOkResponse({ identifier: 'my/agent' }));

      await service.getAgentDetail('my/agent');

      const [url] = (fetch as Mock).mock.calls[0] as [string];
      expect(url).toContain(encodeURIComponent('my/agent'));
    });
  });

  describe('checkAgentExists', () => {
    it('should return true when the agent exists', async () => {
      (fetch as Mock).mockResolvedValue(mockOkResponse({ identifier: 'existing-agent' }));

      const exists = await service.checkAgentExists('existing-agent');

      expect(exists).toBe(true);
    });

    it('should return false when the agent does not exist (request throws)', async () => {
      (fetch as Mock).mockResolvedValue(mockErrorResponse(404, { message: 'Not found' }));

      const exists = await service.checkAgentExists('missing-agent');

      expect(exists).toBe(false);
    });

    it('should return false when fetch itself rejects', async () => {
      (fetch as Mock).mockRejectedValue(new Error('Network error'));

      const exists = await service.checkAgentExists('any-agent');

      expect(exists).toBe(false);
    });
  });

  describe('createAgentVersion', () => {
    it('should POST to createAgentVersion endpoint with version data', async () => {
      const mockResult = { identifier: 'agent-v1' };
      (fetch as Mock).mockResolvedValue(mockOkResponse(mockResult));

      const result = await service.createAgentVersion({
        identifier: 'my-agent',
        name: 'v1.0',
        url: 'https://example.com/agent',
      });

      expect(fetch).toHaveBeenCalledWith(
        MARKET_ENDPOINTS.createAgentVersion,
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result).toEqual(mockResult);
    });

    it('should throw when identifier is missing', async () => {
      await expect(
        service.createAgentVersion({ identifier: '', name: 'v1' }),
      ).rejects.toThrow('Identifier is required');
    });

    it('should include identifier in request body', async () => {
      (fetch as Mock).mockResolvedValue(mockOkResponse({ identifier: 'my-agent' }));

      await service.createAgentVersion({
        identifier: 'my-agent',
        name: 'v1.0',
        description: 'First version',
      });

      const [, init] = (fetch as Mock).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.identifier).toBe('my-agent');
      expect(body.name).toBe('v1.0');
      expect(body.description).toBe('First version');
    });

    it('should not call fetch when identifier is empty', async () => {
      await expect(
        service.createAgentVersion({ identifier: '' }),
      ).rejects.toThrow('Identifier is required');

      expect(fetch).not.toHaveBeenCalled();
    });
  });
});
