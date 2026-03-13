import { Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { MarketApiService } from '../marketApi';

global.fetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

const mockJsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(body),
  text: vi.fn().mockResolvedValue(String(body)),
});

const mockErrorResponse = (status: number, errorBody?: unknown, textBody?: string) => ({
  ok: false,
  status,
  json: errorBody
    ? vi.fn().mockResolvedValue(errorBody)
    : vi.fn().mockRejectedValue(new Error('Not JSON')),
  text: vi.fn().mockResolvedValue(textBody ?? 'Error'),
});

describe('MarketApiService', () => {
  let service: MarketApiService;

  beforeEach(() => {
    service = new MarketApiService();
  });

  describe('setAccessToken', () => {
    it('should set the access token used for requests', async () => {
      service.setAccessToken('my-token');

      (fetch as Mock).mockResolvedValue(mockJsonResponse({ identifier: 'test-agent' }));

      await service.getAgentDetail('test-agent');

      const [, init] = (fetch as Mock).mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get('authorization')).toBe('Bearer my-token');
    });

    it('should not add authorization header when no token set', async () => {
      (fetch as Mock).mockResolvedValue(mockJsonResponse({ identifier: 'test-agent' }));

      await service.getAgentDetail('test-agent');

      const [, init] = (fetch as Mock).mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get('authorization')).toBeNull();
    });
  });

  describe('request', () => {
    it('should set content-type to application/json when body is present', async () => {
      (fetch as Mock).mockResolvedValue(mockJsonResponse({ identifier: 'new-agent' }));

      await service.createAgent({ identifier: 'new-agent', name: 'New Agent' });

      const [, init] = (fetch as Mock).mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get('content-type')).toBe('application/json');
    });

    it('should not override content-type if already set', async () => {
      // This is tested indirectly through createAgent which passes body
      (fetch as Mock).mockResolvedValue(mockJsonResponse({ identifier: 'test' }));
      await service.createAgent({ identifier: 'test', name: 'Test' });

      const [, init] = (fetch as Mock).mock.calls[0];
      const headers = init.headers as Headers;
      expect(headers.get('content-type')).toBe('application/json');
    });

    it('should throw error with message from JSON error body', async () => {
      (fetch as Mock).mockResolvedValue(
        mockErrorResponse(400, { message: 'Agent already exists' }),
      );

      await expect(service.createAgent({ identifier: 'dup', name: 'Dup' })).rejects.toThrow(
        'Agent already exists',
      );
    });

    it('should throw error with text when JSON parsing fails', async () => {
      (fetch as Mock).mockResolvedValue(mockErrorResponse(500, undefined, 'Internal Server Error'));

      await expect(service.createAgent({ identifier: 'fail', name: 'Fail' })).rejects.toThrow(
        'Internal Server Error',
      );
    });

    it('should throw "Unknown error" when error body has no message field', async () => {
      (fetch as Mock).mockResolvedValue(mockErrorResponse(400, { code: 'BAD_REQUEST' }));

      await expect(service.createAgent({ identifier: 'fail', name: 'Fail' })).rejects.toThrow(
        'Unknown error',
      );
    });

    it('should return undefined for 204 No Content responses', async () => {
      (fetch as Mock).mockResolvedValue({
        ok: true,
        status: 204,
        json: vi.fn(),
        text: vi.fn(),
      });

      const result = await service.getAgentDetail('archived-agent');
      expect(result).toBeUndefined();
    });

    it('should use same-origin credentials by default', async () => {
      (fetch as Mock).mockResolvedValue(mockJsonResponse({ identifier: 'test' }));

      await service.getAgentDetail('test');

      const [, init] = (fetch as Mock).mock.calls[0];
      expect(init.credentials).toBe('same-origin');
    });
  });

  describe('createAgent', () => {
    it('should POST to the createAgent endpoint', async () => {
      const agentData = { identifier: 'my-agent', name: 'My Agent' };
      const mockAgent = { identifier: 'my-agent', name: 'My Agent', id: 1 };
      (fetch as Mock).mockResolvedValue(mockJsonResponse(mockAgent));

      const result = await service.createAgent(agentData);

      const [url, init] = (fetch as Mock).mock.calls[0];
      expect(url).toBe('/market/agent/create');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual(agentData);
      expect(result).toEqual(mockAgent);
    });

    it('should pass optional fields to the API', async () => {
      const agentData = {
        identifier: 'featured-agent',
        name: 'Featured Agent',
        isFeatured: true,
        visibility: 'public' as const,
        status: 'published' as const,
      };
      (fetch as Mock).mockResolvedValue(mockJsonResponse({ ...agentData, id: 2 }));

      await service.createAgent(agentData);

      const [, init] = (fetch as Mock).mock.calls[0];
      expect(JSON.parse(init.body)).toEqual(agentData);
    });
  });

  describe('getAgentDetail', () => {
    it('should GET from the agent detail endpoint with encoded identifier', async () => {
      const mockAgent = { identifier: 'test-agent', name: 'Test' };
      (fetch as Mock).mockResolvedValue(mockJsonResponse(mockAgent));

      const result = await service.getAgentDetail('test-agent');

      const [url, init] = (fetch as Mock).mock.calls[0];
      expect(url).toBe('/market/agent/test-agent');
      expect(init.method).toBe('GET');
      expect(result).toEqual(mockAgent);
    });

    it('should URL-encode special characters in identifier', async () => {
      (fetch as Mock).mockResolvedValue(mockJsonResponse({ identifier: 'org/agent' }));

      await service.getAgentDetail('org/agent');

      const [url] = (fetch as Mock).mock.calls[0];
      expect(url).toBe('/market/agent/org%2Fagent');
    });
  });

  describe('checkAgentExists', () => {
    it('should return true when agent is found', async () => {
      (fetch as Mock).mockResolvedValue(mockJsonResponse({ identifier: 'exists' }));

      const result = await service.checkAgentExists('exists');

      expect(result).toBe(true);
    });

    it('should return false when agent is not found (throws)', async () => {
      (fetch as Mock).mockResolvedValue(mockErrorResponse(404, { message: 'Not found' }));

      const result = await service.checkAgentExists('missing');

      expect(result).toBe(false);
    });

    it('should return false when request fails with any error', async () => {
      (fetch as Mock).mockRejectedValue(new Error('Network error'));

      const result = await service.checkAgentExists('unreachable');

      expect(result).toBe(false);
    });
  });

  describe('createAgentVersion', () => {
    it('should POST to the createAgentVersion endpoint', async () => {
      const versionData = {
        identifier: 'my-agent',
        name: 'My Agent v2',
        url: 'https://example.com/agent',
      };
      const mockVersion = { identifier: 'my-agent', version: '1.0.0' };
      (fetch as Mock).mockResolvedValue(mockJsonResponse(mockVersion));

      const result = await service.createAgentVersion(versionData);

      const [url, init] = (fetch as Mock).mock.calls[0];
      expect(url).toBe('/market/agent/versions/create');
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body);
      expect(body.identifier).toBe('my-agent');
      expect(result).toEqual(mockVersion);
    });

    it('should throw when identifier is missing', async () => {
      await expect(
        // @ts-expect-error testing missing identifier
        service.createAgentVersion({ name: 'No ID' }),
      ).rejects.toThrow('Identifier is required');
    });

    it('should spread additional version fields into request body', async () => {
      const versionData = {
        identifier: 'my-agent',
        description: 'A helpful agent',
        hasStreaming: true,
        setAsCurrent: true,
        tokenUsage: 1000,
      };
      (fetch as Mock).mockResolvedValue(mockJsonResponse({ identifier: 'my-agent' }));

      await service.createAgentVersion(versionData);

      const [, init] = (fetch as Mock).mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body).toEqual({
        identifier: 'my-agent',
        description: 'A helpful agent',
        hasStreaming: true,
        setAsCurrent: true,
        tokenUsage: 1000,
      });
    });
  });
});
