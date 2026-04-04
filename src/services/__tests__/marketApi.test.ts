import { Mock, beforeEach, describe, expect, it, vi } from 'vitest';

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
  }) as unknown as Response;

const mockErrorResponse = (status: number, jsonBody?: unknown, text?: string) =>
  ({
    ok: false,
    status,
    json: jsonBody !== undefined ? () => Promise.resolve(jsonBody) : () => Promise.reject(new Error('not json')),
    text: () => Promise.resolve(text ?? ''),
  }) as unknown as Response;

describe('MarketApiService', () => {
  let service: MarketApiService;

  beforeEach(() => {
    service = new MarketApiService();
  });

  describe('setAccessToken', () => {
    it('should set the access token used in subsequent requests', async () => {
      service.setAccessToken('test-token');

      (fetch as Mock).mockResolvedValue(mockOkResponse({ identifier: 'agent-1' }));

      await service.getAgentDetail('agent-1');

      const [, init] = (fetch as Mock).mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get('authorization')).toBe('Bearer test-token');
    });

    it('should not set authorization header when no token is set', async () => {
      (fetch as Mock).mockResolvedValue(mockOkResponse({ identifier: 'agent-1' }));

      await service.getAgentDetail('agent-1');

      const [, init] = (fetch as Mock).mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get('authorization')).toBeNull();
    });
  });

  describe('request (via public methods)', () => {
    it('should set content-type header for POST requests with body', async () => {
      (fetch as Mock).mockResolvedValue(mockOkResponse({ identifier: 'agent-1' }));

      await service.createAgent({ identifier: 'agent-1', name: 'Test Agent' });

      const [, init] = (fetch as Mock).mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get('content-type')).toBe('application/json');
    });

    it('should not override existing content-type header', async () => {
      (fetch as Mock).mockResolvedValue(mockOkResponse({ identifier: 'agent-1' }));

      // Access private request method via createAgent which always uses application/json
      await service.createAgent({ identifier: 'agent-1', name: 'Test Agent' });

      const [, init] = (fetch as Mock).mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get('content-type')).toBe('application/json');
    });

    it('should throw error with message from JSON error body', async () => {
      (fetch as Mock).mockResolvedValue(
        mockErrorResponse(400, { message: 'Bad request from server' }),
      );

      await expect(service.getAgentDetail('bad-id')).rejects.toThrow('Bad request from server');
    });

    it('should throw error with text when JSON parsing fails', async () => {
      (fetch as Mock).mockResolvedValue(mockErrorResponse(500, undefined, 'Internal Server Error'));

      await expect(service.getAgentDetail('bad-id')).rejects.toThrow('Internal Server Error');
    });

    it('should throw Unknown error when error body has no message field', async () => {
      (fetch as Mock).mockResolvedValue(mockErrorResponse(500, {}, ''));

      await expect(service.getAgentDetail('bad-id')).rejects.toThrow('Unknown error');
    });

    it('should throw Market request failed when json fails and text is empty', async () => {
      (fetch as Mock).mockResolvedValue(mockErrorResponse(500, undefined, ''));

      await expect(service.getAgentDetail('bad-id')).rejects.toThrow('Market request failed');
    });

    it('should return undefined for 204 No Content responses', async () => {
      (fetch as Mock).mockResolvedValue({
        ok: true,
        status: 204,
        json: vi.fn(),
      } as unknown as Response);

      const result = await service.getAgentDetail('agent-1');
      expect(result).toBeUndefined();
    });

    it('should use same-origin credentials by default', async () => {
      (fetch as Mock).mockResolvedValue(mockOkResponse({ identifier: 'agent-1' }));

      await service.getAgentDetail('agent-1');

      const [, init] = (fetch as Mock).mock.calls[0];
      expect(init.credentials).toBe('same-origin');
    });
  });

  describe('createAgent', () => {
    it('should POST to createAgent endpoint with agent data', async () => {
      const agentData = { identifier: 'my-agent', name: 'My Agent' };
      const mockResponse = { identifier: 'my-agent', name: 'My Agent' };

      (fetch as Mock).mockResolvedValue(mockOkResponse(mockResponse));

      const result = await service.createAgent(agentData);

      expect(result).toEqual(mockResponse);
      const [url, init] = (fetch as Mock).mock.calls[0];
      expect(url).toBe('/market/agent/create');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual(agentData);
    });

    it('should include optional fields in request body', async () => {
      const agentData = {
        identifier: 'my-agent',
        name: 'My Agent',
        homepage: 'https://example.com',
        isFeatured: true,
        status: 'published' as const,
        visibility: 'public' as const,
        tokenUsage: 100,
      };

      (fetch as Mock).mockResolvedValue(mockOkResponse(agentData));

      await service.createAgent(agentData);

      const [, init] = (fetch as Mock).mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.homepage).toBe('https://example.com');
      expect(body.isFeatured).toBe(true);
      expect(body.status).toBe('published');
    });
  });

  describe('getAgentDetail', () => {
    it('should GET agent detail by identifier', async () => {
      const mockAgent = { identifier: 'my-agent', name: 'My Agent' };

      (fetch as Mock).mockResolvedValue(mockOkResponse(mockAgent));

      const result = await service.getAgentDetail('my-agent');

      expect(result).toEqual(mockAgent);
      const [url, init] = (fetch as Mock).mock.calls[0];
      expect(url).toBe('/market/agent/my-agent');
      expect(init.method).toBe('GET');
    });

    it('should URL-encode the identifier', async () => {
      (fetch as Mock).mockResolvedValue(mockOkResponse({}));

      await service.getAgentDetail('agent/with/slashes');

      const [url] = (fetch as Mock).mock.calls[0];
      expect(url).toBe('/market/agent/agent%2Fwith%2Fslashes');
    });
  });

  describe('checkAgentExists', () => {
    it('should return true when agent exists', async () => {
      (fetch as Mock).mockResolvedValue(mockOkResponse({ identifier: 'existing-agent' }));

      const result = await service.checkAgentExists('existing-agent');

      expect(result).toBe(true);
    });

    it('should return false when agent does not exist (fetch throws)', async () => {
      (fetch as Mock).mockResolvedValue(mockErrorResponse(404, { message: 'Not Found' }));

      const result = await service.checkAgentExists('non-existent-agent');

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      (fetch as Mock).mockRejectedValue(new Error('Network failure'));

      const result = await service.checkAgentExists('any-agent');

      expect(result).toBe(false);
    });
  });

  describe('createAgentVersion', () => {
    it('should POST to createAgentVersion endpoint with version data', async () => {
      const versionData = {
        identifier: 'my-agent',
        name: 'My Agent v1',
        description: 'First version',
        url: 'https://example.com',
      };
      const mockResponse = { identifier: 'my-agent' };

      (fetch as Mock).mockResolvedValue(mockOkResponse(mockResponse));

      const result = await service.createAgentVersion(versionData);

      expect(result).toEqual(mockResponse);
      const [url, init] = (fetch as Mock).mock.calls[0];
      expect(url).toBe('/market/agent/versions/create');
      expect(init.method).toBe('POST');
    });

    it('should throw error when identifier is missing', async () => {
      await expect(
        service.createAgentVersion({ identifier: '', name: 'My Agent' }),
      ).rejects.toThrow('Identifier is required');

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should include identifier in request body', async () => {
      (fetch as Mock).mockResolvedValue(mockOkResponse({}));

      await service.createAgentVersion({ identifier: 'my-agent', name: 'Test' });

      const [, init] = (fetch as Mock).mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.identifier).toBe('my-agent');
      expect(body.name).toBe('Test');
    });

    it('should handle optional version fields', async () => {
      (fetch as Mock).mockResolvedValue(mockOkResponse({}));

      const versionData = {
        identifier: 'my-agent',
        avatar: 'https://example.com/avatar.png',
        category: 'productivity',
        changelog: 'Initial release',
        setAsCurrent: true,
        tokenUsage: 500,
      };

      await service.createAgentVersion(versionData);

      const [, init] = (fetch as Mock).mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.avatar).toBe('https://example.com/avatar.png');
      expect(body.setAsCurrent).toBe(true);
      expect(body.tokenUsage).toBe(500);
    });
  });
});
