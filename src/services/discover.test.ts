import { CategoryItem } from '@lobehub/market-sdk';
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
      getAssistantCategories: { query: vi.fn() },
      getAssistantDetail: { query: vi.fn() },
      getAssistantIdentifiers: { query: vi.fn() },
      getAssistantList: { query: vi.fn() },
      getMcpCategories: { query: vi.fn() },
      getMcpDetail: { query: vi.fn() },
      getMcpList: { query: vi.fn() },
      getMcpManifest: { query: vi.fn() },
      getModelCategories: { query: vi.fn() },
      getModelDetail: { query: vi.fn() },
      getModelIdentifiers: { query: vi.fn() },
      getModelList: { query: vi.fn() },
      getPluginCategories: { query: vi.fn() },
      getPluginDetail: { query: vi.fn() },
      getPluginIdentifiers: { query: vi.fn() },
      getPluginList: { query: vi.fn() },
      getProviderDetail: { query: vi.fn() },
      getProviderIdentifiers: { query: vi.fn() },
      getProviderList: { query: vi.fn() },
      registerClientInMarketplace: { mutate: vi.fn() },
      registerM2MToken: { query: vi.fn() },
      reportMcpInstallResult: { mutate: vi.fn() },
      reportCall: { mutate: vi.fn() },
    },
  },
}));

vi.mock('@/store/global/helpers', () => ({
  globalHelpers: {
    getCurrentLanguage: vi.fn(),
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
    vi.resetModules();
    (globalHelpers.getCurrentLanguage as any).mockReturnValue('en-US');

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

    // Mock document.cookie
    Object.defineProperty(global, 'document', {
      value: { cookie: '' },
      writable: true,
    });
  });

  describe('Assistant Market', () => {
    describe('getAssistantCategories', () => {
      it('should fetch assistant categories with default params', async () => {
        const mockCategories: CategoryItem[] = [{ category: 'Category 1', count: 10 }];
        vi.spyOn(lambdaClient.market.getAssistantCategories, 'query').mockResolvedValue(
          mockCategories,
        );

        const result = await discoverService.getAssistantCategories();

        expect(result).toEqual(mockCategories);
        expect(lambdaClient.market.getAssistantCategories.query).toHaveBeenCalledWith({
          locale: 'en-US',
          source: undefined,
        });
      });

      it('should fetch assistant categories with source param', async () => {
        const mockCategories: CategoryItem[] = [];
        vi.spyOn(lambdaClient.market.getAssistantCategories, 'query').mockResolvedValue(
          mockCategories,
        );

        await discoverService.getAssistantCategories({ source: 'legacy' });

        expect(lambdaClient.market.getAssistantCategories.query).toHaveBeenCalledWith({
          locale: 'en-US',
          source: 'legacy',
        });
      });
    });

    describe('getAssistantDetail', () => {
      it('should fetch assistant detail with identifier', async () => {
        const mockDetail: any = {
          identifier: 'test-assistant',
          author: 'test-author',
          createdAt: '2024-01-01',
          homepage: 'https://example.com',
          related: [],
          config: {},
          meta: {},
        };
        vi.spyOn(lambdaClient.market.getAssistantDetail, 'query').mockResolvedValue(mockDetail);

        const result = await discoverService.getAssistantDetail({ identifier: 'test-assistant' });

        expect(result).toEqual(mockDetail);
        expect(lambdaClient.market.getAssistantDetail.query).toHaveBeenCalledWith({
          identifier: 'test-assistant',
          locale: 'en-US',
          source: undefined,
          version: undefined,
        });
      });
    });

    describe('getAssistantList', () => {
      it('should fetch assistant list with default pagination', async () => {
        const mockResponse: any = {
          items: [],
          currentPage: 1,
          pageSize: 20,
          totalCount: 0,
          totalPages: 0,
        };
        vi.spyOn(lambdaClient.market.getAssistantList, 'query').mockResolvedValue(mockResponse);

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

      it('should convert page and pageSize to numbers', async () => {
        const mockResponse: any = {
          items: [],
          currentPage: 2,
          pageSize: 50,
          totalCount: 0,
          totalPages: 0,
        };
        vi.spyOn(lambdaClient.market.getAssistantList, 'query').mockResolvedValue(mockResponse);

        await discoverService.getAssistantList({ page: '2' as any, pageSize: '50' as any });

        expect(lambdaClient.market.getAssistantList.query).toHaveBeenCalledWith(
          {
            locale: 'en-US',
            page: 2,
            pageSize: 50,
          },
          { context: { showNotification: false } },
        );
      });
    });
  });

  describe('MCP Market', () => {
    describe('getMcpList', () => {
      it('should fetch MCP list with default pagination', async () => {
        const mockResponse: any = {
          items: [],
          categories: [],
          currentPage: 1,
          pageSize: 20,
          totalCount: 0,
          totalPages: 0,
        };
        vi.spyOn(lambdaClient.market.getMcpList, 'query').mockResolvedValue(mockResponse);

        const result = await discoverService.getMcpList();

        expect(result).toEqual(mockResponse);
        expect(lambdaClient.market.getMcpList.query).toHaveBeenCalledWith({
          locale: 'en-US',
          page: 1,
          pageSize: 20,
        });
      });
    });

    describe('getMCPPluginList', () => {
      it('should inject MP token and fetch MCP plugin list', async () => {
        const mockResponse: any = {
          items: [],
          categories: [],
          currentPage: 1,
          pageSize: 21,
          totalCount: 0,
          totalPages: 0,
        };

        // Mock cookie to indicate active token
        Object.defineProperty(global, 'document', {
          value: { cookie: 'mp_token_status=active' },
          writable: true,
        });

        vi.spyOn(lambdaClient.market.getMcpList, 'query').mockResolvedValue(mockResponse);

        const result = await discoverService.getMCPPluginList({ q: 'test' });

        expect(result).toEqual(mockResponse);
        expect(lambdaClient.market.getMcpList.query).toHaveBeenCalledWith({
          locale: 'en-US',
          page: 1,
          pageSize: 21,
          q: 'test',
        });
      });
    });

    describe('getMCPPluginManifest', () => {
      it('should fetch MCP plugin manifest', async () => {
        const mockManifest: any = {
          identifier: 'test-plugin',
          name: 'Test Plugin',
          description: 'Test',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        };
        vi.spyOn(lambdaClient.market.getMcpManifest, 'query').mockResolvedValue(mockManifest);

        const result = await discoverService.getMCPPluginManifest('test-plugin');

        expect(result).toEqual(mockManifest);
        expect(lambdaClient.market.getMcpManifest.query).toHaveBeenCalledWith({
          identifier: 'test-plugin',
          install: undefined,
          locale: 'en-US',
        });
      });

      it('should fetch MCP plugin manifest with install option', async () => {
        const mockManifest: any = {
          identifier: 'test-plugin',
          name: 'Test Plugin',
          description: 'Test',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        };
        vi.spyOn(lambdaClient.market.getMcpManifest, 'query').mockResolvedValue(mockManifest);

        await discoverService.getMCPPluginManifest('test-plugin', { install: true });

        expect(lambdaClient.market.getMcpManifest.query).toHaveBeenCalledWith({
          identifier: 'test-plugin',
          install: true,
          locale: 'en-US',
        });
      });
    });

    describe('reportMcpInstallResult', () => {
      it('should not report when user disables trace', async () => {
        (preferenceSelectors.userAllowTrace as any).mockReturnValue(false);

        await discoverService.reportMcpInstallResult({
          success: true,
          identifier: 'test-plugin',
          version: '1.0.0',
          manifest: {} as any,
        });

        expect(lambdaClient.market.reportMcpInstallResult.mutate).not.toHaveBeenCalled();
      });

      it('should report successful installation when trace is enabled', async () => {
        (preferenceSelectors.userAllowTrace as any).mockReturnValue(true);

        // Mock cookie to indicate active token
        Object.defineProperty(global, 'document', {
          value: { cookie: 'mp_token_status=active' },
          writable: true,
        });

        const mockManifest = { tools: [], prompts: [], resources: [] };
        vi.spyOn(lambdaClient.market.reportMcpInstallResult, 'mutate').mockResolvedValue({} as any);

        await discoverService.reportMcpInstallResult({
          success: true,
          identifier: 'test-plugin',
          version: '1.0.0',
          manifest: mockManifest as any,
        });

        expect(lambdaClient.market.reportMcpInstallResult.mutate).toHaveBeenCalledWith({
          success: true,
          identifier: 'test-plugin',
          version: '1.0.0',
          manifest: mockManifest,
          errorCode: undefined,
          errorMessage: undefined,
        });
      });

      it('should report failed installation with error details', async () => {
        (preferenceSelectors.userAllowTrace as any).mockReturnValue(true);

        // Mock cookie to indicate active token
        Object.defineProperty(global, 'document', {
          value: { cookie: 'mp_token_status=active' },
          writable: true,
        });

        vi.spyOn(lambdaClient.market.reportMcpInstallResult, 'mutate').mockResolvedValue({} as any);

        await discoverService.reportMcpInstallResult({
          success: false,
          identifier: 'test-plugin',
          version: '1.0.0',
          errorCode: 'INSTALL_ERROR',
          errorMessage: 'Installation failed',
        });

        expect(lambdaClient.market.reportMcpInstallResult.mutate).toHaveBeenCalledWith({
          success: false,
          identifier: 'test-plugin',
          version: '1.0.0',
          errorCode: 'INSTALL_ERROR',
          errorMessage: 'Installation failed',
          manifest: undefined,
        });
      });

      it('should handle report errors gracefully', async () => {
        (preferenceSelectors.userAllowTrace as any).mockReturnValue(true);

        // Mock cookie to indicate active token
        Object.defineProperty(global, 'document', {
          value: { cookie: 'mp_token_status=active' },
          writable: true,
        });

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(lambdaClient.market.reportMcpInstallResult, 'mutate').mockRejectedValue(
          new Error('Report failed'),
        );

        await discoverService.reportMcpInstallResult({
          success: true,
          identifier: 'test-plugin',
          version: '1.0.0',
          manifest: {} as any,
        });

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Failed to report MCP installation result:',
          expect.any(Error),
        );

        consoleWarnSpy.mockRestore();
      });
    });

    describe('reportPluginCall', () => {
      it('should not report when user disables trace', async () => {
        (preferenceSelectors.userAllowTrace as any).mockReturnValue(false);

        await discoverService.reportPluginCall({
          identifier: 'test-plugin',
          methodName: 'testMethod',
          methodType: 'tool',
          callDurationMs: 100,
          success: true,
          version: '1.0.0',
        });

        expect(lambdaClient.market.reportCall.mutate).not.toHaveBeenCalled();
      });

      it('should report plugin call when trace is enabled', async () => {
        (preferenceSelectors.userAllowTrace as any).mockReturnValue(true);

        // Mock cookie to indicate active token
        Object.defineProperty(global, 'document', {
          value: { cookie: 'mp_token_status=active' },
          writable: true,
        });

        vi.spyOn(lambdaClient.market.reportCall, 'mutate').mockReturnValue({
          catch: vi.fn().mockResolvedValue({} as any),
        } as any);

        await discoverService.reportPluginCall({
          identifier: 'test-plugin',
          methodName: 'testMethod',
          methodType: 'tool',
          callDurationMs: 100,
          success: true,
          version: '1.0.0',
        });

        expect(lambdaClient.market.reportCall.mutate).toHaveBeenCalled();
      });
    });
  });

  describe('Models', () => {
    describe('getModelList', () => {
      it('should fetch model list with default pagination', async () => {
        const mockResponse: any = {
          items: [],
          currentPage: 1,
          pageSize: 20,
          totalCount: 0,
          totalPages: 0,
        };
        vi.spyOn(lambdaClient.market.getModelList, 'query').mockResolvedValue(mockResponse);

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

  describe('Plugins', () => {
    describe('getPluginList', () => {
      it('should fetch plugin list with default pagination', async () => {
        const mockResponse: any = {
          items: [],
          categories: [],
          currentPage: 1,
          pageSize: 20,
          totalCount: 0,
          totalPages: 0,
        };
        vi.spyOn(lambdaClient.market.getPluginList, 'query').mockResolvedValue(mockResponse);

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

  describe('Providers', () => {
    describe('getProviderList', () => {
      it('should fetch provider list with default pagination', async () => {
        const mockResponse: any = {
          items: [],
          currentPage: 1,
          pageSize: 20,
          totalCount: 0,
          totalPages: 0,
        };
        vi.spyOn(lambdaClient.market.getProviderList, 'query').mockResolvedValue(mockResponse);

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

  describe('Helper Methods', () => {
    describe('injectMPToken', () => {
      it('should return early if localStorage is undefined (SSR)', async () => {
        Object.defineProperty(global, 'localStorage', { value: undefined, writable: true });

        await discoverService.injectMPToken();

        expect(lambdaClient.market.registerClientInMarketplace.mutate).not.toHaveBeenCalled();
      });

      it('should return early if token status cookie is active', async () => {
        Object.defineProperty(global, 'document', {
          value: { cookie: 'mp_token_status=active' },
          writable: true,
        });

        await discoverService.injectMPToken();

        expect(lambdaClient.market.registerClientInMarketplace.mutate).not.toHaveBeenCalled();
      });

      it('should register new client when no client data exists', async () => {
        const localStorageMock = {
          getItem: vi.fn().mockReturnValue(null),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        };
        Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

        const mockClientInfo = { clientId: 'client-123', clientSecret: 'secret-456' };
        vi.spyOn(lambdaClient.market.registerClientInMarketplace, 'mutate').mockResolvedValue(
          mockClientInfo,
        );
        vi.spyOn(lambdaClient.market.registerM2MToken, 'query').mockResolvedValue({
          success: true,
        });

        await discoverService.injectMPToken();

        expect(lambdaClient.market.registerClientInMarketplace.mutate).toHaveBeenCalled();
        expect(localStorageMock.setItem).toHaveBeenCalledWith('_mpc', expect.any(String));
        expect(lambdaClient.market.registerM2MToken.query).toHaveBeenCalledWith({
          clientId: 'client-123',
          clientSecret: 'secret-456',
        });
      });

      it('should use existing client data when available', async () => {
        const clientData = { clientId: 'client-123', clientSecret: 'secret-456' };
        const encodedData = btoa(JSON.stringify(clientData));

        const localStorageMock = {
          getItem: vi.fn().mockReturnValue(encodedData),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        };
        Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

        vi.spyOn(lambdaClient.market.registerM2MToken, 'query').mockResolvedValue({
          success: true,
        });

        await discoverService.injectMPToken();

        expect(lambdaClient.market.registerClientInMarketplace.mutate).not.toHaveBeenCalled();
        expect(lambdaClient.market.registerM2MToken.query).toHaveBeenCalledWith({
          clientId: 'client-123',
          clientSecret: 'secret-456',
        });
      });

      it('should handle decoding errors and re-register', async () => {
        const localStorageMock = {
          getItem: vi.fn().mockReturnValue('invalid-base64'),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        };
        Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const mockClientInfo = { clientId: 'new-client', clientSecret: 'new-secret' };
        vi.spyOn(lambdaClient.market.registerClientInMarketplace, 'mutate').mockResolvedValue(
          mockClientInfo,
        );
        vi.spyOn(lambdaClient.market.registerM2MToken, 'query').mockResolvedValue({
          success: true,
        });

        await discoverService.injectMPToken();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to decode client data:',
          expect.any(Error),
        );
        expect(lambdaClient.market.registerClientInMarketplace.mutate).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
      });

      it('should retry once on token registration failure', async () => {
        const localStorageMock = {
          getItem: vi.fn().mockReturnValueOnce(null),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        };
        Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

        const mockClientInfo = { clientId: 'client-123', clientSecret: 'secret-456' };
        vi.spyOn(lambdaClient.market.registerClientInMarketplace, 'mutate').mockResolvedValue(
          mockClientInfo,
        );

        // First call fails, second call succeeds
        vi.spyOn(lambdaClient.market.registerM2MToken, 'query')
          .mockResolvedValueOnce({ success: false })
          .mockResolvedValueOnce({ success: true });

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await discoverService.injectMPToken();

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Token registration failed, client credentials may be invalid. Clearing and retrying...',
        );
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('_mpc');

        consoleWarnSpy.mockRestore();
      });

      it('should not retry more than once', async () => {
        const localStorageMock = {
          getItem: vi.fn().mockReturnValue(null),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        };
        Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

        const mockClientInfo = { clientId: 'client-123', clientSecret: 'secret-456' };
        vi.spyOn(lambdaClient.market.registerClientInMarketplace, 'mutate').mockResolvedValue(
          mockClientInfo,
        );

        // Always fail
        vi.spyOn(lambdaClient.market.registerM2MToken, 'query').mockResolvedValue({
          success: false,
        });

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await discoverService.injectMPToken();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to re-register after credential invalidation',
        );

        consoleErrorSpy.mockRestore();
      });

      it('should handle M2M token registration errors', async () => {
        const localStorageMock = {
          getItem: vi.fn().mockReturnValue(null),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        };
        Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

        const mockClientInfo = { clientId: 'client-123', clientSecret: 'secret-456' };
        vi.spyOn(lambdaClient.market.registerClientInMarketplace, 'mutate').mockResolvedValue(
          mockClientInfo,
        );
        vi.spyOn(lambdaClient.market.registerM2MToken, 'query').mockRejectedValue(
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

    describe('getTokenStatusFromCookie', () => {
      it('should parse token status from cookie', async () => {
        Object.defineProperty(global, 'document', {
          value: { cookie: 'other=value; mp_token_status=active; another=data' },
          writable: true,
        });

        await discoverService.injectMPToken();

        // Should return early due to active token
        expect(lambdaClient.market.registerClientInMarketplace.mutate).not.toHaveBeenCalled();
      });

      it('should return null when token status cookie is not found', async () => {
        Object.defineProperty(global, 'document', {
          value: { cookie: 'other=value; another=data' },
          writable: true,
        });

        const localStorageMock = {
          getItem: vi.fn().mockReturnValue(null),
          setItem: vi.fn(),
          removeItem: vi.fn(),
        };
        Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

        const mockClientInfo = { clientId: 'client-123', clientSecret: 'secret-456' };
        vi.spyOn(lambdaClient.market.registerClientInMarketplace, 'mutate').mockResolvedValue(
          mockClientInfo,
        );
        vi.spyOn(lambdaClient.market.registerM2MToken, 'query').mockResolvedValue({
          success: true,
        });

        await discoverService.injectMPToken();

        // Should proceed with token injection
        expect(lambdaClient.market.registerClientInMarketplace.mutate).toHaveBeenCalled();
      });
    });

    describe('registerClient', () => {
      it('should call registerClientInMarketplace', async () => {
        const mockClientInfo = { clientId: 'client-123', clientSecret: 'secret-456' };
        vi.spyOn(lambdaClient.market.registerClientInMarketplace, 'mutate').mockResolvedValue(
          mockClientInfo,
        );

        const result = await discoverService.registerClient();

        expect(result).toEqual(mockClientInfo);
        expect(lambdaClient.market.registerClientInMarketplace.mutate).toHaveBeenCalledWith({});
      });
    });
  });
});
