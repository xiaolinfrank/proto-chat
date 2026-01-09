import { beforeEach, describe, expect, it, vi } from 'vitest';

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
      reportCall: {
        mutate: vi.fn(),
      },
      reportMcpInstallResult: {
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
    getState: vi.fn(() => ({
      preference: {
        telemetry: true,
      },
    })),
  },
}));

vi.mock('@/store/user/selectors', () => ({
  preferenceSelectors: {
    userAllowTrace: vi.fn(() => true),
  },
}));

vi.mock('@/utils/object', () => ({
  cleanObject: vi.fn((obj) => obj),
}));

describe('DiscoverService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset localStorage mock
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    // Reset document.cookie
    if (typeof document !== 'undefined') {
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        writable: true,
        value: '',
      });
    }
  });

  describe('Assistant Market', () => {
    it('should get assistant categories with locale', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const { globalHelpers } = await import('@/store/global/helpers');

      const mockCategories = [
        { category: 'cat1', count: 10 },
        { category: 'cat2', count: 20 },
      ] as any;

      vi.mocked(lambdaClient.market.getAssistantCategories.query).mockResolvedValue(
        mockCategories,
      );
      vi.mocked(globalHelpers.getCurrentLanguage).mockReturnValue('zh-CN');

      const result = await discoverService.getAssistantCategories({ source: 'legacy' } as any);

      expect(result).toEqual(mockCategories);
      expect(lambdaClient.market.getAssistantCategories.query).toHaveBeenCalledWith({
        locale: 'zh-CN',
        source: 'legacy',
      });
    });

    it('should get assistant detail with correct parameters', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const { globalHelpers } = await import('@/store/global/helpers');

      const mockDetail = {
        identifier: 'assistant-1',
        related: [],
        config: {},
      } as any;

      vi.mocked(lambdaClient.market.getAssistantDetail.query).mockResolvedValue(mockDetail);
      vi.mocked(globalHelpers.getCurrentLanguage).mockReturnValue('en-US');

      const result = await discoverService.getAssistantDetail({
        identifier: 'assistant-1',
        source: 'legacy',
        version: '1.0.0',
      });

      expect(result).toEqual(mockDetail);
      expect(lambdaClient.market.getAssistantDetail.query).toHaveBeenCalledWith({
        identifier: 'assistant-1',
        locale: 'en-US',
        source: 'legacy',
        version: '1.0.0',
      });
    });

    it('should get assistant identifiers', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockIdentifiers = [
        { identifier: 'id1', lastModified: '2024-01-01' },
        { identifier: 'id2', lastModified: '2024-01-02' },
      ];

      vi.mocked(lambdaClient.market.getAssistantIdentifiers.query).mockResolvedValue(
        mockIdentifiers,
      );

      const result = await discoverService.getAssistantIdentifiers({ source: 'legacy' } as any);

      expect(result).toEqual(mockIdentifiers);
      expect(lambdaClient.market.getAssistantIdentifiers.query).toHaveBeenCalledWith({
        source: 'legacy',
      });
    });

    it('should get assistant list with pagination and locale', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const { globalHelpers } = await import('@/store/global/helpers');

      const mockList = {
        items: [],
        currentPage: 2,
        pageSize: 10,
        totalCount: 100,
        totalPages: 10,
      };

      vi.mocked(lambdaClient.market.getAssistantList.query).mockResolvedValue(mockList);
      vi.mocked(globalHelpers.getCurrentLanguage).mockReturnValue('ja-JP');

      const result = await discoverService.getAssistantList({
        page: 2,
        pageSize: 10,
        category: 'productivity',
      });

      expect(result).toEqual(mockList);
      expect(lambdaClient.market.getAssistantList.query).toHaveBeenCalledWith(
        {
          category: 'productivity',
          locale: 'ja-JP',
          page: 2,
          pageSize: 10,
        },
        { context: { showNotification: false } },
      );
    });

    it('should use default pagination values', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      vi.mocked(lambdaClient.market.getAssistantList.query).mockResolvedValue({
        items: [],
        currentPage: 1,
        pageSize: 20,
        totalCount: 0,
        totalPages: 0,
      });

      await discoverService.getAssistantList({});

      expect(lambdaClient.market.getAssistantList.query).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 20,
        }),
        expect.any(Object),
      );
    });
  });

  describe('MCP Market', () => {
    it('should get MCP categories', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockCategories = [{ category: 'mcp1', count: 10 }] as any;

      vi.mocked(lambdaClient.market.getMcpCategories.query).mockResolvedValue(mockCategories);

      const result = await discoverService.getMcpCategories({});

      expect(result).toEqual(mockCategories);
      expect(lambdaClient.market.getMcpCategories.query).toHaveBeenCalled();
    });

    it('should get MCP detail', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const { globalHelpers } = await import('@/store/global/helpers');

      const mockDetail = { identifier: 'mcp-1', related: [] } as any;

      vi.mocked(lambdaClient.market.getMcpDetail.query).mockResolvedValue(mockDetail);
      vi.mocked(globalHelpers.getCurrentLanguage).mockReturnValue('ko-KR');

      const result = await discoverService.getMcpDetail({
        identifier: 'mcp-1',
        version: '2.0.0',
      });

      expect(result).toEqual(mockDetail);
      expect(lambdaClient.market.getMcpDetail.query).toHaveBeenCalledWith({
        identifier: 'mcp-1',
        locale: 'ko-KR',
        version: '2.0.0',
      });
    });

    it('should get MCP list with pagination', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockList = {
        items: [],
        currentPage: 3,
        pageSize: 15,
        totalCount: 0,
        totalPages: 0,
        categories: [],
      } as any;

      vi.mocked(lambdaClient.market.getMcpList.query).mockResolvedValue(mockList);

      await discoverService.getMcpList({ page: 3, pageSize: 15 });

      expect(lambdaClient.market.getMcpList.query).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 3,
          pageSize: 15,
        }),
      );
    });

    it('should get MCP manifest', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockManifest = {
        identifier: 'mcp-1',
        version: '1.0.0',
        createdAt: '',
        description: '',
        name: '',
        updatedAt: '',
      } as any;

      vi.mocked(lambdaClient.market.getMcpManifest.query).mockResolvedValue(mockManifest);

      const result = await discoverService.getMcpManifest({
        identifier: 'mcp-1',
        version: '1.0.0',
      });

      expect(result).toEqual(mockManifest);
      expect(lambdaClient.market.getMcpManifest.query).toHaveBeenCalled();
    });

    it('should get MCP plugin manifest with install option', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const { globalHelpers } = await import('@/store/global/helpers');

      const mockManifest = {
        identifier: 'plugin-1',
        version: '1.0.0',
        createdAt: '',
        description: '',
        name: '',
        updatedAt: '',
      } as any;

      vi.mocked(lambdaClient.market.getMcpManifest.query).mockResolvedValue(mockManifest);
      vi.mocked(globalHelpers.getCurrentLanguage).mockReturnValue('en-US');

      const result = await discoverService.getMCPPluginManifest('plugin-1', { install: true });

      expect(result).toEqual(mockManifest);
      expect(lambdaClient.market.getMcpManifest.query).toHaveBeenCalledWith({
        identifier: 'plugin-1',
        install: true,
        locale: 'en-US',
      });
    });
  });

  describe('Model Market', () => {
    it('should get model categories', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockCategories = [{ category: 'model1', count: 10 }] as any;

      vi.mocked(lambdaClient.market.getModelCategories.query).mockResolvedValue(mockCategories);

      const result = await discoverService.getModelCategories({});

      expect(result).toEqual(mockCategories);
      expect(lambdaClient.market.getModelCategories.query).toHaveBeenCalled();
    });

    it('should get model detail', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockDetail = { identifier: 'model-1', related: [] } as any;

      vi.mocked(lambdaClient.market.getModelDetail.query).mockResolvedValue(mockDetail);

      const result = await discoverService.getModelDetail({ identifier: 'model-1' });

      expect(result).toEqual(mockDetail);
      expect(lambdaClient.market.getModelDetail.query).toHaveBeenCalled();
    });

    it('should get model identifiers', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockIdentifiers = [
        { identifier: 'model1', lastModified: '2024-01-01' },
        { identifier: 'model2', lastModified: '2024-01-02' },
      ];

      vi.mocked(lambdaClient.market.getModelIdentifiers.query).mockResolvedValue(mockIdentifiers);

      const result = await discoverService.getModelIdentifiers();

      expect(result).toEqual(mockIdentifiers);
      expect(lambdaClient.market.getModelIdentifiers.query).toHaveBeenCalled();
    });

    it('should get model list', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockList = {
        items: [],
        currentPage: 1,
        pageSize: 20,
        totalCount: 0,
        totalPages: 0,
      } as any;

      vi.mocked(lambdaClient.market.getModelList.query).mockResolvedValue(mockList);

      await discoverService.getModelList({ page: 1, pageSize: 20 });

      expect(lambdaClient.market.getModelList.query).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 20,
        }),
      );
    });
  });

  describe('Plugin Market', () => {
    it('should get plugin categories', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockCategories = [{ category: 'plugin1', count: 10 }] as any;

      vi.mocked(lambdaClient.market.getPluginCategories.query).mockResolvedValue(mockCategories);

      const result = await discoverService.getPluginCategories({});

      expect(result).toEqual(mockCategories);
      expect(lambdaClient.market.getPluginCategories.query).toHaveBeenCalled();
    });

    it('should get plugin detail with manifest', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockDetail = { identifier: 'plugin-1', related: [] } as any;

      vi.mocked(lambdaClient.market.getPluginDetail.query).mockResolvedValue(mockDetail);

      const result = await discoverService.getPluginDetail({
        identifier: 'plugin-1',
        withManifest: true,
      });

      expect(result).toEqual(mockDetail);
      expect(lambdaClient.market.getPluginDetail.query).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'plugin-1',
          withManifest: true,
        }),
      );
    });

    it('should get plugin identifiers', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockIdentifiers = [
        { identifier: 'plugin1', lastModified: '2024-01-01' },
        { identifier: 'plugin2', lastModified: '2024-01-02' },
      ];

      vi.mocked(lambdaClient.market.getPluginIdentifiers.query).mockResolvedValue(mockIdentifiers);

      const result = await discoverService.getPluginIdentifiers();

      expect(result).toEqual(mockIdentifiers);
      expect(lambdaClient.market.getPluginIdentifiers.query).toHaveBeenCalled();
    });

    it('should get plugin list', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockList = {
        items: [],
        currentPage: 2,
        pageSize: 20,
        totalCount: 0,
        totalPages: 0,
        categories: [],
      } as any;

      vi.mocked(lambdaClient.market.getPluginList.query).mockResolvedValue(mockList);

      await discoverService.getPluginList({ page: 2 });

      expect(lambdaClient.market.getPluginList.query).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          pageSize: 20,
        }),
      );
    });
  });

  describe('Provider Market', () => {
    it('should get provider detail', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockDetail = { identifier: 'provider-1', related: [] } as any;

      vi.mocked(lambdaClient.market.getProviderDetail.query).mockResolvedValue(mockDetail);

      const result = await discoverService.getProviderDetail({
        identifier: 'provider-1',
        withReadme: true,
      });

      expect(result).toEqual(mockDetail);
      expect(lambdaClient.market.getProviderDetail.query).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'provider-1',
          withReadme: true,
        }),
      );
    });

    it('should get provider identifiers', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockIdentifiers = [
        { identifier: 'provider1', lastModified: '2024-01-01' },
        { identifier: 'provider2', lastModified: '2024-01-02' },
      ];

      vi.mocked(lambdaClient.market.getProviderIdentifiers.query).mockResolvedValue(
        mockIdentifiers,
      );

      const result = await discoverService.getProviderIdentifiers();

      expect(result).toEqual(mockIdentifiers);
      expect(lambdaClient.market.getProviderIdentifiers.query).toHaveBeenCalled();
    });

    it('should get provider list', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockList = {
        items: [],
        currentPage: 1,
        pageSize: 20,
        totalCount: 0,
        totalPages: 0,
      } as any;

      vi.mocked(lambdaClient.market.getProviderList.query).mockResolvedValue(mockList);

      await discoverService.getProviderList({});

      expect(lambdaClient.market.getProviderList.query).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 20,
        }),
      );
    });
  });

  describe('Reporting', () => {
    it('should report MCP installation success', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const { preferenceSelectors } = await import('@/store/user/selectors');

      vi.mocked(preferenceSelectors.userAllowTrace).mockReturnValue(true);
      vi.mocked(lambdaClient.market.registerM2MToken.query).mockResolvedValue({ success: true });
      vi.mocked(lambdaClient.market.reportMcpInstallResult.mutate).mockResolvedValue({} as any);

      const reportData = {
        success: true,
        identifier: 'mcp-plugin',
        version: '1.0.0',
        manifest: { version: '1.0.0' },
      } as any;

      // Mock localStorage
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(() => btoa(JSON.stringify({ clientId: 'test', clientSecret: 'secret' }))),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      });

      // Mock document.cookie
      vi.stubGlobal('document', {
        cookie: 'mp_token_status=active',
      });

      await discoverService.reportMcpInstallResult(reportData);

      // Should not be called if token status is active
      expect(lambdaClient.market.registerM2MToken.query).not.toHaveBeenCalled();
    });

    it('should not report MCP installation when user disallows trace', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const { preferenceSelectors } = await import('@/store/user/selectors');

      vi.mocked(preferenceSelectors.userAllowTrace).mockReturnValue(false);

      const reportData = {
        success: false,
        identifier: 'mcp-plugin',
        version: '1.0.0',
        errorMessage: 'Installation failed',
        errorCode: 'ERROR_CODE',
      } as any;

      await discoverService.reportMcpInstallResult(reportData);

      expect(lambdaClient.market.reportMcpInstallResult.mutate).not.toHaveBeenCalled();
    });

    it('should report plugin call', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const { preferenceSelectors } = await import('@/store/user/selectors');

      vi.mocked(preferenceSelectors.userAllowTrace).mockReturnValue(true);
      vi.mocked(lambdaClient.market.registerM2MToken.query).mockResolvedValue({ success: true });
      vi.mocked(lambdaClient.market.reportCall.mutate).mockResolvedValue({} as any);

      // Mock localStorage and document
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(() => btoa(JSON.stringify({ clientId: 'test', clientSecret: 'secret' }))),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      });

      vi.stubGlobal('document', {
        cookie: 'mp_token_status=active',
      });

      const reportData = {
        identifier: 'test-plugin',
        methodName: 'testMethod',
        methodType: 'tool' as const,
        callDurationMs: 100,
        version: '1.0.0',
        success: true,
      } as any;

      await discoverService.reportPluginCall(reportData);

      // Token should not be registered if already active
      expect(lambdaClient.market.registerM2MToken.query).not.toHaveBeenCalled();
    });

    it('should not report plugin call when user disallows trace', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const { preferenceSelectors } = await import('@/store/user/selectors');

      vi.mocked(preferenceSelectors.userAllowTrace).mockReturnValue(false);

      const reportData = {
        identifier: 'test-plugin',
        methodName: 'testMethod',
        methodType: 'tool' as const,
        callDurationMs: 100,
        version: '1.0.0',
        success: false,
        errorMessage: 'Call failed',
      } as any;

      await discoverService.reportPluginCall(reportData);

      expect(lambdaClient.market.reportCall.mutate).not.toHaveBeenCalled();
    });

    it('should handle report errors silently', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');
      const { preferenceSelectors } = await import('@/store/user/selectors');

      vi.mocked(preferenceSelectors.userAllowTrace).mockReturnValue(true);
      vi.mocked(lambdaClient.market.reportCall.mutate).mockRejectedValue(
        new Error('Network error'),
      );

      // Mock console.warn to check it's called
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock localStorage and document
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(() => btoa(JSON.stringify({ clientId: 'test', clientSecret: 'secret' }))),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      });

      vi.stubGlobal('document', {
        cookie: 'mp_token_status=active',
      });

      const reportData = {
        identifier: 'test-plugin',
        methodName: 'testMethod',
        methodType: 'tool' as const,
        callDurationMs: 100,
        version: '1.0.0',
        success: true,
      } as any;

      // Should not throw error
      await expect(discoverService.reportPluginCall(reportData)).resolves.toBeUndefined();

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Client Registration', () => {
    it('should register client', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockClientInfo = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      };

      vi.mocked(lambdaClient.market.registerClientInMarketplace.mutate).mockResolvedValue(
        mockClientInfo,
      );

      const result = await discoverService.registerClient();

      expect(result).toEqual(mockClientInfo);
      expect(lambdaClient.market.registerClientInMarketplace.mutate).toHaveBeenCalledWith({});
    });
  });

  describe('Token Management', () => {
    it('should inject MP token when not in active status', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockClientInfo = {
        clientId: 'new-client-id',
        clientSecret: 'new-secret',
      };

      vi.mocked(lambdaClient.market.registerClientInMarketplace.mutate).mockResolvedValue(
        mockClientInfo,
      );
      vi.mocked(lambdaClient.market.registerM2MToken.query).mockResolvedValue({ success: true });

      // Mock localStorage
      const mockLocalStorage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      };
      vi.stubGlobal('localStorage', mockLocalStorage);

      // Mock document without active token
      vi.stubGlobal('document', {
        cookie: '',
      });

      await discoverService.injectMPToken();

      expect(lambdaClient.market.registerClientInMarketplace.mutate).toHaveBeenCalled();
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        '_mpc',
        expect.any(String), // Base64 encoded string
      );
      expect(lambdaClient.market.registerM2MToken.query).toHaveBeenCalledWith({
        clientId: mockClientInfo.clientId,
        clientSecret: mockClientInfo.clientSecret,
      });
    });

    it('should skip token injection when status is active', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      // Mock document with active token
      vi.stubGlobal('document', {
        cookie: 'mp_token_status=active',
      });

      vi.stubGlobal('localStorage', {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      });

      await discoverService.injectMPToken();

      expect(lambdaClient.market.registerM2MToken.query).not.toHaveBeenCalled();
    });

    it('should reuse existing client credentials from localStorage', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const existingCredentials = {
        clientId: 'existing-id',
        clientSecret: 'existing-secret',
      };

      const encodedData = btoa(JSON.stringify(existingCredentials));

      const mockLocalStorage = {
        getItem: vi.fn(() => encodedData),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      };
      vi.stubGlobal('localStorage', mockLocalStorage);

      vi.stubGlobal('document', {
        cookie: '',
      });

      vi.mocked(lambdaClient.market.registerM2MToken.query).mockResolvedValue({ success: true });

      await discoverService.injectMPToken();

      expect(lambdaClient.market.registerClientInMarketplace.mutate).not.toHaveBeenCalled();
      expect(lambdaClient.market.registerM2MToken.query).toHaveBeenCalledWith(
        existingCredentials,
      );
    });

    it('should handle corrupted localStorage data', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockClientInfo = {
        clientId: 'new-client-id',
        clientSecret: 'new-secret',
      };

      const mockLocalStorage = {
        getItem: vi.fn(() => 'corrupted-data-not-base64'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      };
      vi.stubGlobal('localStorage', mockLocalStorage);

      vi.stubGlobal('document', {
        cookie: '',
      });

      vi.mocked(lambdaClient.market.registerClientInMarketplace.mutate).mockResolvedValue(
        mockClientInfo,
      );
      vi.mocked(lambdaClient.market.registerM2MToken.query).mockResolvedValue({ success: true });

      // Mock console.error to verify it's called
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await discoverService.injectMPToken();

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(lambdaClient.market.registerClientInMarketplace.mutate).toHaveBeenCalled();
      expect(mockLocalStorage.setItem).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should retry once on token registration failure', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockClientInfo = {
        clientId: 'client-id',
        clientSecret: 'client-secret',
      };

      const newClientInfo = {
        clientId: 'new-client-id',
        clientSecret: 'new-secret',
      };

      const encodedData = btoa(JSON.stringify(mockClientInfo));

      let getItemCallCount = 0;
      const mockLocalStorage = {
        getItem: vi.fn(() => {
          getItemCallCount++;
          // First call returns existing data, second call (after removeItem) returns null
          return getItemCallCount === 1 ? encodedData : null;
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      };
      vi.stubGlobal('localStorage', mockLocalStorage);

      vi.stubGlobal('document', {
        cookie: '',
      });

      // First call fails, second succeeds
      vi.mocked(lambdaClient.market.registerM2MToken.query)
        .mockResolvedValueOnce({ success: false })
        .mockResolvedValueOnce({ success: true });

      vi.mocked(lambdaClient.market.registerClientInMarketplace.mutate).mockResolvedValue(
        newClientInfo,
      );

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await discoverService.injectMPToken();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Token registration failed, client credentials may be invalid. Clearing and retrying...',
      );
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('_mpc');
      expect(lambdaClient.market.registerClientInMarketplace.mutate).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should handle token registration error', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockClientInfo = {
        clientId: 'client-id',
        clientSecret: 'client-secret',
      };

      const encodedData = btoa(JSON.stringify(mockClientInfo));

      const mockLocalStorage = {
        getItem: vi.fn(() => encodedData),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      };
      vi.stubGlobal('localStorage', mockLocalStorage);

      vi.stubGlobal('document', {
        cookie: '',
      });

      vi.mocked(lambdaClient.market.registerM2MToken.query).mockRejectedValue(
        new Error('Network error'),
      );

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await discoverService.injectMPToken();

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to register M2M token:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it('should return early when localStorage is not available', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      vi.stubGlobal('localStorage', undefined);

      await discoverService.injectMPToken();

      expect(lambdaClient.market.registerM2MToken.query).not.toHaveBeenCalled();
    });
  });

  describe('getMCPPluginList', () => {
    it('should inject token before getting MCP plugin list', async () => {
      const { lambdaClient } = await import('@/libs/trpc/client');

      const mockList = {
        items: [],
        currentPage: 1,
        pageSize: 21,
        totalCount: 0,
        totalPages: 0,
        categories: [],
      } as any;

      vi.stubGlobal('localStorage', {
        getItem: vi.fn(() => btoa(JSON.stringify({ clientId: 'test', clientSecret: 'secret' }))),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
      });

      vi.stubGlobal('document', {
        cookie: 'mp_token_status=active',
      });

      vi.mocked(lambdaClient.market.getMcpList.query).mockResolvedValue(mockList);

      await discoverService.getMCPPluginList({ page: 1, pageSize: 21 });

      expect(lambdaClient.market.getMcpList.query).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 21,
        }),
      );
    });
  });
});
