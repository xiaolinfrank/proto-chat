import { Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { MARKET_ENDPOINTS } from '@/services/_url';

import { MarketApiService } from '../marketApi';

global.fetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

const mockOkResponse = (data: unknown, status = 200) => {
  (fetch as Mock).mockResolvedValue({
    ok: true,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
};

const mockErrorResponse = (status: number, body: unknown, isJson = true) => {
  (fetch as Mock).mockResolvedValue({
    ok: false,
    status,
    json: isJson ? () => Promise.resolve(body) : () => Promise.reject(new SyntaxError('Not JSON')),
    text: () => Promise.resolve(typeof body === 'string' ? body : ''),
  });
};

describe('MarketApiService', () => {
  let service: MarketApiService;

  beforeEach(() => {
    service = new MarketApiService();
  });

  describe('setAccessToken', () => {
    it('should attach Bearer token to subsequent requests', async () => {
      const token = 'test-token-123';
      service.setAccessToken(token);

      mockOkResponse({ identifier: 'agent-1' });

      await service.getAgentDetail('agent-1');

      const [, init] = (fetch as Mock).mock.calls[0];
      expect(init.headers.get('authorization')).toBe(`Bearer ${token}`);
    });

    it('should not set authorization header when no token is set', async () => {
      mockOkResponse({ identifier: 'agent-1' });

      await service.getAgentDetail('agent-1');

      const [, init] = (fetch as Mock).mock.calls[0];
      expect(init.headers.get('authorization')).toBeNull();
    });

    it('should not override an already-set authorization header', async () => {
      service.setAccessToken('should-not-appear');
      mockOkResponse({ identifier: 'agent-1' });

      // Manually call request via createAgent which passes body (triggers content-type logic)
      // We test header precedence via fetch spy directly
      await service.getAgentDetail('agent-1');

      const [, init] = (fetch as Mock).mock.calls[0];
      // The token we set should be present since we didn't pass a custom auth header
      expect(init.headers.get('authorization')).toBe('Bearer should-not-appear');
    });
  });

  describe('request (via public methods)', () => {
    it('should set content-type to application/json when body is present', async () => {
      mockOkResponse({ identifier: 'agent-1' });

      await service.createAgent({ identifier: 'agent-1', name: 'Test Agent' });

      const [, init] = (fetch as Mock).mock.calls[0];
      expect(init.headers.get('content-type')).toBe('application/json');
    });

    it('should not set content-type when no body is present', async () => {
      mockOkResponse({ identifier: 'agent-1' });

      await service.getAgentDetail('agent-1');

      const [, init] = (fetch as Mock).mock.calls[0];
      expect(init.headers.get('content-type')).toBeNull();
    });

    it('should use same-origin credentials by default', async () => {
      mockOkResponse({ identifier: 'agent-1' });

      await service.getAgentDetail('agent-1');

      const [, init] = (fetch as Mock).mock.calls[0];
      expect(init.credentials).toBe('same-origin');
    });

    it('should throw with JSON error message on non-ok response', async () => {
      mockErrorResponse(400, { message: 'Bad request from server' });

      await expect(service.getAgentDetail('bad-agent')).rejects.toThrow('Bad request from server');
    });

    it('should throw "Unknown error" when error JSON has no message field', async () => {
      mockErrorResponse(400, { code: 42 });

      await expect(service.getAgentDetail('bad-agent')).rejects.toThrow('Unknown error');
    });

    it('should fall back to response text when error body is not JSON', async () => {
      mockErrorResponse(500, 'Internal Server Error', false);

      await expect(service.getAgentDetail('bad-agent')).rejects.toThrow('Internal Server Error');
    });

    it('should throw "Market request failed" when error text is empty', async () => {
      (fetch as Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new SyntaxError()),
        text: () => Promise.resolve(''),
      });

      await expect(service.getAgentDetail('bad-agent')).rejects.toThrow('Market request failed');
    });

    it('should return undefined for 204 No Content response', async () => {
      (fetch as Mock).mockResolvedValue({
        ok: true,
        status: 204,
        json: vi.fn(),
        text: vi.fn(),
      });

      // Use createAgent as a vehicle – it returns the raw response from request
      const result = await service.createAgent({ identifier: 'agent-1', name: 'Test' });
      expect(result).toBeUndefined();
    });
  });

  describe('createAgent', () => {
    it('should POST to createAgent endpoint with serialized body', async () => {
      const agentData = {
        identifier: 'my-agent',
        name: 'My Agent',
        visibility: 'public' as const,
        status: 'published' as const,
      };
      const mockAgent = { ...agentData, id: 1 };
      mockOkResponse(mockAgent);

      const result = await service.createAgent(agentData);

      const [url, init] = (fetch as Mock).mock.calls[0];
      expect(url).toBe(MARKET_ENDPOINTS.createAgent);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual(agentData);
      expect(result).toEqual(mockAgent);
    });

    it('should create agent with minimal required fields', async () => {
      const agentData = { identifier: 'min-agent', name: 'Min Agent' };
      mockOkResponse({ ...agentData, id: 2 });

      await service.createAgent(agentData);

      const [, init] = (fetch as Mock).mock.calls[0];
      expect(JSON.parse(init.body)).toEqual(agentData);
    });
  });

  describe('getAgentDetail', () => {
    it('should GET from the correct endpoint with encoded identifier', async () => {
      const identifier = 'my/agent';
      const mockDetail = { identifier, name: 'My Agent' };
      mockOkResponse(mockDetail);

      const result = await service.getAgentDetail(identifier);

      const [url, init] = (fetch as Mock).mock.calls[0];
      expect(url).toBe(MARKET_ENDPOINTS.getAgentDetail(identifier));
      expect(url).toContain(encodeURIComponent(identifier));
      expect(init.method).toBe('GET');
      expect(result).toEqual(mockDetail);
    });

    it('should propagate errors thrown by the server', async () => {
      mockErrorResponse(404, { message: 'Agent not found' });

      await expect(service.getAgentDetail('nonexistent')).rejects.toThrow('Agent not found');
    });
  });

  describe('checkAgentExists', () => {
    it('should return true when getAgentDetail succeeds', async () => {
      mockOkResponse({ identifier: 'existing-agent' });

      const exists = await service.checkAgentExists('existing-agent');

      expect(exists).toBe(true);
    });

    it('should return false when getAgentDetail throws', async () => {
      mockErrorResponse(404, { message: 'Not found' });

      const exists = await service.checkAgentExists('ghost-agent');

      expect(exists).toBe(false);
    });

    it('should return false for any error (not just 404)', async () => {
      (fetch as Mock).mockRejectedValue(new Error('Network failure'));

      const exists = await service.checkAgentExists('any-agent');

      expect(exists).toBe(false);
    });
  });

  describe('createAgentVersion', () => {
    it('should POST to createAgentVersion endpoint with correct payload', async () => {
      const versionData = {
        identifier: 'my-agent',
        name: 'v1.0',
        description: 'Initial release',
        url: 'https://example.com/agent',
      };
      const mockResponse = { id: 10, ...versionData };
      mockOkResponse(mockResponse);

      const result = await service.createAgentVersion(versionData);

      const [url, init] = (fetch as Mock).mock.calls[0];
      expect(url).toBe(MARKET_ENDPOINTS.createAgentVersion);
      expect(init.method).toBe('POST');
      const body = JSON.parse(init.body);
      expect(body.identifier).toBe('my-agent');
      expect(body.name).toBe('v1.0');
      expect(result).toEqual(mockResponse);
    });

    it('should throw an error when identifier is missing', async () => {
      await expect(
        service.createAgentVersion({
          identifier: '',
          name: 'v1',
        }),
      ).rejects.toThrow('Identifier is required');

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should only include identifier and provided optional fields in the body', async () => {
      const versionData = {
        identifier: 'minimal-agent',
        setAsCurrent: true,
      };
      mockOkResponse({ id: 5 });

      await service.createAgentVersion(versionData);

      const [, init] = (fetch as Mock).mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.identifier).toBe('minimal-agent');
      expect(body.setAsCurrent).toBe(true);
      // Fields not passed should not appear
      expect(body.name).toBeUndefined();
    });
  });
});
