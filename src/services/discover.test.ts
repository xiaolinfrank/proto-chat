import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lambdaClient } from '@/libs/trpc/client';
import { globalHelpers } from '@/store/global/helpers';
import { useUserStore } from '@/store/user';
import { preferenceSelectors } from '@/store/user/selectors';

import { discoverService } from './discover';

// Mock dependencies
vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    market: {
      getAssistantCategories: {
        query: vi.fn(),
      },
      getAssistantDetail: {
        query: vi.fn(),
      },
      getAssistantIdentifiers: {
        query: vi.fn(),
      },
      getAssistantList: {
        query: vi.fn(),
      },
      getMcpCategories: {
        query: vi.fn(),
      },
      getMcpDetail: {
        query: vi.fn(),
      },
      getMcpList: {
        query: vi.fn(),
      },
      getMcpManifest: {
        query: vi.fn(),
      },
      getModelCategories: {
        query: vi.fn(),
      },
      getModelDetail: {
        query: vi.fn(),
      },
      getModelIdentifiers: {
        query: vi.fn(),
      },
      getModelList: {
        query: vi.fn(),
      },
      getPluginCategories: {
        query: vi.fn(),
      },
      getPluginDetail: {
        query: vi.fn(),
      },
      getPluginIdentifiers: {
        query: vi.fn(),
      },
      getPluginList: {
        query: vi.fn(),
      },
      getProviderDetail: {
        query: vi.fn(),
      },
      getProviderIdentifiers: {
        query: vi.fn(),
      },
      getProviderList: {
        query: vi.fn(),
      },
      registerClientInMarketplace: {
        mutate: vi.fn(),
      },
      registerM2MToken: {
        query: vi.fn(),
      },
      reportMcpInstallResult: {
        mutate: vi.fn(),
      },
      reportCall: {
        mutate: vi.fn(),
      },
    },
  },
}));

vi.mock('@/store/global/helpers', () => ({
  globalHelpers: {
    getCurrentLanguage: vi.fn(() => 'en-US'),
  },
}));

vi.mock('@/store/user', () => ({
  useUserStore: {
    getState: vi.fn(),
  },
}));

vi.mock('@/store/user/selectors', () => ({
  preferenceSelectors: {
    userAllowTrace: vi.fn(),
  },
}));

vi.mock('@/utils/object', () => ({
  cleanObject: vi.fn((obj) => obj),
}));

describe('DiscoverService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset localStorage
    global.localStorage = {
      clear: vi.fn(),
      getItem: vi.fn(),
      key: vi.fn(),
      length: 0,
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    // Reset document.cookie
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      writable: true,
      value: '',
    });
  });

  describe('Assistant Market', () => {
    describe('getAssistantCategories', () => {
      it('should fetch assistant categories with locale', async () => {
        const mockCategories = [{ category: 'cat1', count: 10 }];
        vi.mocked(lambdaClient.market.getAssistantCategories.query).mockResolvedValue(
          mockCategories,
        );

        const result = await discoverService.getAssistantCategories();

        expect(result).toEqual(mockCategories);
        expect(lambdaClient.market.getAssistantCategories.query).toHaveBeenCalledWith({
          locale: 'en-US',
          source: undefined,
        });
      });

      it('should pass source parameter when provided', async () => {
        const mockCategories = [{ category: 'cat1', count: 10 }];
        vi.mocked(lambdaClient.market.getAssistantCategories.query).mockResolvedValue(
          mockCategories,
        );

        await discoverService.getAssistantCategories({ source: 'legacy' });

        expect(lambdaClient.market.getAssistantCategories.query).toHaveBeenCalledWith({
          locale: 'en-US',
          source: 'legacy',
        });
      });
    });

    describe('getAssistantList', () => {
      it('should fetch assistant list with default pagination', async () => {
        const mockResponse = {
          currentPage: 1,
          items: [],
          pageSize: 20,
          totalCount: 0,
          totalPages: 0,
        };
        vi.mocked(lambdaClient.market.getAssistantList.query).mockResolvedValue(mockResponse);

        const result = await discoverService.getAssistantList();

        expect(result).toEqual(mockResponse);
        expect(lambdaClient.market.getAssistantList.query).toHaveBeenCalledWith(
          {
            locale: 'en-US',
            page: 1,
            pageSize: 20,
          },
          { context: { showNotification: false } },
        );
      });

      it('should use custom pagination params', async () => {
        const mockResponse = {
          currentPage: 3,
          items: [],
          pageSize: 50,
          totalCount: 0,
          totalPages: 0,
        };
        vi.mocked(lambdaClient.market.getAssistantList.query).mockResolvedValue(mockResponse);

        await discoverService.getAssistantList({ page: 3, pageSize: 50 });

        expect(lambdaClient.market.getAssistantList.query).toHaveBeenCalledWith(
          {
            locale: 'en-US',
            page: 3,
            pageSize: 50,
          },
          { context: { showNotification: false } },
        );
      });

      it('should convert string pagination params to numbers', async () => {
        const mockResponse = {
          currentPage: 2,
          items: [],
          pageSize: 30,
          totalCount: 0,
          totalPages: 0,
        };
        vi.mocked(lambdaClient.market.getAssistantList.query).mockResolvedValue(mockResponse);

        await discoverService.getAssistantList({ page: '2' as any, pageSize: '30' as any });

        expect(lambdaClient.market.getAssistantList.query).toHaveBeenCalledWith(
          {
            locale: 'en-US',
            page: 2,
            pageSize: 30,
          },
          { context: { showNotification: false } },
        );
      });
    });
  });

  describe('MCP Market', () => {
    describe('getMcpList', () => {
      it('should fetch MCP list with default pagination', async () => {
        const mockResponse = {
          categories: [],
          currentPage: 1,
          items: [],
          pageSize: 20,
          totalCount: 0,
          totalPages: 0,
        };
        vi.mocked(lambdaClient.market.getMcpList.query).mockResolvedValue(mockResponse);

        const result = await discoverService.getMcpList();

        expect(result).toEqual(mockResponse);
        expect(lambdaClient.market.getMcpList.query).toHaveBeenCalledWith({
          locale: 'en-US',
          page: 1,
          pageSize: 20,
        });
      });
    });

    describe('reportMcpInstallResult', () => {
      it('should not report when user disallows tracing', async () => {
        vi.mocked(preferenceSelectors.userAllowTrace).mockReturnValue(false);

        await discoverService.reportMcpInstallResult({
          errorCode: undefined,
          errorMessage: undefined,
          identifier: 'test-plugin',
          manifest: { prompts: [], resources: [], tools: [] },
          success: true,
          version: '1.0.0',
        });

        expect(lambdaClient.market.reportMcpInstallResult.mutate).not.toHaveBeenCalled();
      });

      it('should report successful installation when tracing allowed', async () => {
        vi.mocked(preferenceSelectors.userAllowTrace).mockReturnValue(true);
        vi.mocked(lambdaClient.market.reportMcpInstallResult.mutate).mockResolvedValue(
          {} as any,
        );

        // Mock cookie for token status
        Object.defineProperty(document, 'cookie', {
          configurable: true,
          writable: true,
          value: 'mp_token_status=active',
        });

        await discoverService.reportMcpInstallResult({
          errorCode: undefined,
          errorMessage: undefined,
          identifier: 'test-plugin',
          manifest: { prompts: [], resources: [], tools: [] },
          success: true,
          version: '1.0.0',
        });

        expect(lambdaClient.market.reportMcpInstallResult.mutate).toHaveBeenCalledWith({
          errorCode: undefined,
          errorMessage: undefined,
          identifier: 'test-plugin',
          manifest: { prompts: [], resources: [], tools: [] },
          success: true,
          version: '1.0.0',
        });
      });

      it('should report failed installation with error details', async () => {
        vi.mocked(preferenceSelectors.userAllowTrace).mockReturnValue(true);
        vi.mocked(lambdaClient.market.reportMcpInstallResult.mutate).mockResolvedValue(
          {} as any,
        );

        Object.defineProperty(document, 'cookie', {
          configurable: true,
          writable: true,
          value: 'mp_token_status=active',
        });

        await discoverService.reportMcpInstallResult({
          errorCode: 'INSTALL_FAILED',
          errorMessage: 'Installation error occurred',
          identifier: 'test-plugin',
          manifest: undefined,
          success: false,
          version: '1.0.0',
        });

        expect(lambdaClient.market.reportMcpInstallResult.mutate).toHaveBeenCalledWith({
          errorCode: 'INSTALL_FAILED',
          errorMessage: 'Installation error occurred',
          identifier: 'test-plugin',
          manifest: undefined,
          success: false,
          version: '1.0.0',
        });
      });

      it('should silently catch report errors', async () => {
        vi.mocked(preferenceSelectors.userAllowTrace).mockReturnValue(true);
        vi.mocked(lambdaClient.market.reportMcpInstallResult.mutate).mockRejectedValue(
          new Error('Network error'),
        );

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        Object.defineProperty(document, 'cookie', {
          configurable: true,
          writable: true,
          value: 'mp_token_status=active',
        });

        await discoverService.reportMcpInstallResult({
          errorCode: undefined,
          errorMessage: undefined,
          identifier: 'test-plugin',
          manifest: { prompts: [], resources: [], tools: [] },
          success: true,
          version: '1.0.0',
        });

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Failed to report MCP installation result:',
          expect.any(Error),
        );

        consoleWarnSpy.mockRestore();
      });
    });
  });

  describe('Model Market', () => {
    describe('getModelList', () => {
      it('should fetch model list with default pagination', async () => {
        const mockResponse = {
          currentPage: 1,
          items: [],
          pageSize: 20,
          totalCount: 0,
          totalPages: 0,
        };
        vi.mocked(lambdaClient.market.getModelList.query).mockResolvedValue(mockResponse);

        const result = await discoverService.getModelList();

        expect(result).toEqual(mockResponse);
        expect(lambdaClient.market.getModelList.query).toHaveBeenCalledWith({
          locale: 'en-US',
          page: 1,
          pageSize: 20,
        });
      });
    });
  });

  describe('Plugin Market', () => {
    describe('getPluginList', () => {
      it('should fetch plugin list with default pagination', async () => {
        const mockResponse = {
          categories: [],
          currentPage: 1,
          items: [],
          pageSize: 20,
          totalCount: 0,
          totalPages: 0,
        };
        vi.mocked(lambdaClient.market.getPluginList.query).mockResolvedValue(mockResponse);

        const result = await discoverService.getPluginList();

        expect(result).toEqual(mockResponse);
        expect(lambdaClient.market.getPluginList.query).toHaveBeenCalledWith({
          locale: 'en-US',
          page: 1,
          pageSize: 20,
        });
      });
    });
  });

  describe('Provider Market', () => {
    describe('getProviderList', () => {
      it('should fetch provider list with default pagination', async () => {
        const mockResponse = {
          currentPage: 1,
          items: [],
          pageSize: 20,
          totalCount: 0,
          totalPages: 0,
        };
        vi.mocked(lambdaClient.market.getProviderList.query).mockResolvedValue(mockResponse);

        const result = await discoverService.getProviderList();

        expect(result).toEqual(mockResponse);
        expect(lambdaClient.market.getProviderList.query).toHaveBeenCalledWith({
          locale: 'en-US',
          page: 1,
          pageSize: 20,
        });
      });
    });
  });

  describe('Token Management', () => {
    describe('getTokenStatusFromCookie', () => {
      it('should return token status from cookie', () => {
        Object.defineProperty(document, 'cookie', {
          configurable: true,
          writable: true,
          value: 'mp_token_status=active; other=value',
        });

        // Access private method through any cast
        const status = (discoverService as any).getTokenStatusFromCookie();

        expect(status).toBe('active');
      });

      it('should return null when cookie not found', () => {
        Object.defineProperty(document, 'cookie', {
          configurable: true,
          writable: true,
          value: 'other=value',
        });

        const status = (discoverService as any).getTokenStatusFromCookie();

        expect(status).toBeNull();
      });

      it('should handle empty cookie string', () => {
        Object.defineProperty(document, 'cookie', {
          configurable: true,
          writable: true,
          value: '',
        });

        const status = (discoverService as any).getTokenStatusFromCookie();

        expect(status).toBeNull();
      });

      it('should return null in non-browser environment', () => {
        // Mock document as undefined
        const originalDocument = global.document;
        (global as any).document = undefined;

        const status = (discoverService as any).getTokenStatusFromCookie();

        expect(status).toBeNull();

        // Restore document
        global.document = originalDocument;
      });
    });

    describe('injectMPToken', () => {
      it('should return early if localStorage is undefined', async () => {
        const originalLocalStorage = global.localStorage;
        (global as any).localStorage = undefined;

        await discoverService.injectMPToken();

        expect(lambdaClient.market.registerClientInMarketplace.mutate).not.toHaveBeenCalled();

        global.localStorage = originalLocalStorage;
      });

      it('should skip token injection if cookie status is active', async () => {
        Object.defineProperty(document, 'cookie', {
          configurable: true,
          writable: true,
          value: 'mp_token_status=active',
        });

        await discoverService.injectMPToken();

        expect(lambdaClient.market.registerClientInMarketplace.mutate).not.toHaveBeenCalled();
      });

      it('should register new client when localStorage is empty', async () => {
        vi.mocked(localStorage.getItem).mockReturnValue(null);
        vi.mocked(lambdaClient.market.registerClientInMarketplace.mutate).mockResolvedValue({
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
        });
        vi.mocked(lambdaClient.market.registerM2MToken.query).mockResolvedValue({
          success: true,
        });

        await discoverService.injectMPToken();

        expect(lambdaClient.market.registerClientInMarketplace.mutate).toHaveBeenCalled();
        expect(localStorage.setItem).toHaveBeenCalledWith(
          '_mpc',
          btoa(JSON.stringify({ clientId: 'test-client-id', clientSecret: 'test-client-secret' })),
        );
        expect(lambdaClient.market.registerM2MToken.query).toHaveBeenCalledWith({
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
        });
      });

      it('should decode existing client data from localStorage', async () => {
        const clientData = { clientId: 'existing-id', clientSecret: 'existing-secret' };
        const encoded = btoa(JSON.stringify(clientData));
        vi.mocked(localStorage.getItem).mockReturnValue(encoded);
        vi.mocked(lambdaClient.market.registerM2MToken.query).mockResolvedValue({
          success: true,
        });

        await discoverService.injectMPToken();

        expect(lambdaClient.market.registerClientInMarketplace.mutate).not.toHaveBeenCalled();
        expect(lambdaClient.market.registerM2MToken.query).toHaveBeenCalledWith({
          clientId: 'existing-id',
          clientSecret: 'existing-secret',
        });
      });

      it('should re-register when decoding fails', async () => {
        vi.mocked(localStorage.getItem).mockReturnValue('invalid-base64-data');
        vi.mocked(lambdaClient.market.registerClientInMarketplace.mutate).mockResolvedValue({
          clientId: 'new-client-id',
          clientSecret: 'new-client-secret',
        });
        vi.mocked(lambdaClient.market.registerM2MToken.query).mockResolvedValue({
          success: true,
        });

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await discoverService.injectMPToken();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to decode client data:',
          expect.any(Error),
        );
        expect(lambdaClient.market.registerClientInMarketplace.mutate).toHaveBeenCalled();
        expect(localStorage.setItem).toHaveBeenCalledWith(
          '_mpc',
          btoa(JSON.stringify({ clientId: 'new-client-id', clientSecret: 'new-client-secret' })),
        );

        consoleErrorSpy.mockRestore();
      });

      it('should clear localStorage and retry once when token registration fails', async () => {
        const clientData = { clientId: 'test-id', clientSecret: 'test-secret' };
        const encoded = btoa(JSON.stringify(clientData));

        // First call returns invalid credentials
        vi.mocked(localStorage.getItem)
          .mockReturnValueOnce(encoded)
          .mockReturnValueOnce(null); // Second call after clearing

        vi.mocked(lambdaClient.market.registerM2MToken.query)
          .mockResolvedValueOnce({ success: false }) // First attempt fails
          .mockResolvedValueOnce({ success: true }); // Second attempt succeeds

        vi.mocked(lambdaClient.market.registerClientInMarketplace.mutate).mockResolvedValue({
          clientId: 'new-client-id',
          clientSecret: 'new-client-secret',
        });

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await discoverService.injectMPToken();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Token registration failed, client credentials may be invalid. Clearing and retrying...',
        );
        expect(localStorage.removeItem).toHaveBeenCalledWith('_mpc');
        expect(lambdaClient.market.registerClientInMarketplace.mutate).toHaveBeenCalled();

        consoleWarnSpy.mockRestore();
      });

      it('should prevent infinite retry loop', async () => {
        const clientData = { clientId: 'test-id', clientSecret: 'test-secret' };
        const encoded = btoa(JSON.stringify(clientData));

        // Always return invalid credentials
        vi.mocked(localStorage.getItem).mockReturnValue(encoded);
        vi.mocked(lambdaClient.market.registerM2MToken.query).mockResolvedValue({
          success: false,
        });

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await discoverService.injectMPToken();

        // Should only attempt retry once
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to re-register after credential invalidation',
        );

        consoleErrorSpy.mockRestore();
      });

      it('should handle M2M token registration errors', async () => {
        vi.mocked(localStorage.getItem).mockReturnValue(null);
        vi.mocked(lambdaClient.market.registerClientInMarketplace.mutate).mockResolvedValue({
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
        });
        vi.mocked(lambdaClient.market.registerM2MToken.query).mockRejectedValue(
          new Error('Network error'),
        );

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await discoverService.injectMPToken();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to register M2M token:',
          expect.any(Error),
        );
        expect(result).toBeNull();

        consoleErrorSpy.mockRestore();
      });
    });

    describe('registerClient', () => {
      it('should call registerClientInMarketplace', async () => {
        const mockResponse = { clientId: 'test-id', clientSecret: 'test-secret' };
        vi.mocked(lambdaClient.market.registerClientInMarketplace.mutate).mockResolvedValue(
          mockResponse,
        );

        const result = await discoverService.registerClient();

        expect(result).toEqual(mockResponse);
        expect(lambdaClient.market.registerClientInMarketplace.mutate).toHaveBeenCalledWith({});
      });
    });
  });

  describe('reportPluginCall', () => {
    it('should not report when user disallows tracing', async () => {
      vi.mocked(preferenceSelectors.userAllowTrace).mockReturnValue(false);

      await discoverService.reportPluginCall({
        callDurationMs: 100,
        identifier: 'test-plugin',
        methodName: 'testMethod',
        methodType: 'tool',
        success: true,
        version: '1.0.0',
      });

      expect(lambdaClient.market.reportCall.mutate).not.toHaveBeenCalled();
    });

    it('should report plugin call when tracing allowed', async () => {
      vi.mocked(preferenceSelectors.userAllowTrace).mockReturnValue(true);
      vi.mocked(lambdaClient.market.reportCall.mutate).mockResolvedValue({} as any);

      Object.defineProperty(document, 'cookie', {
        configurable: true,
        writable: true,
        value: 'mp_token_status=active',
      });

      await discoverService.reportPluginCall({
        callDurationMs: 100,
        identifier: 'test-plugin',
        methodName: 'testMethod',
        methodType: 'tool',
        success: true,
        version: '1.0.0',
      });

      expect(lambdaClient.market.reportCall.mutate).toHaveBeenCalledWith({
        callDurationMs: 100,
        identifier: 'test-plugin',
        methodName: 'testMethod',
        methodType: 'tool',
        success: true,
        version: '1.0.0',
      });
    });

    it('should silently catch report call errors', async () => {
      vi.mocked(preferenceSelectors.userAllowTrace).mockReturnValue(true);
      vi.mocked(lambdaClient.market.reportCall.mutate).mockRejectedValue(
        new Error('Network error'),
      );

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      Object.defineProperty(document, 'cookie', {
        configurable: true,
        writable: true,
        value: 'mp_token_status=active',
      });

      await discoverService.reportPluginCall({
        callDurationMs: 100,
        identifier: 'test-plugin',
        methodName: 'testMethod',
        methodType: 'tool',
        success: true,
        version: '1.0.0',
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to report call:', expect.any(Error));

      consoleWarnSpy.mockRestore();
    });
  });
});
