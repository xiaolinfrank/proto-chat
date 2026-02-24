import { Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { lambdaClient } from '@/libs/trpc/client';
import { globalHelpers } from '@/store/global/helpers';
import { useUserStore } from '@/store/user';
import { preferenceSelectors } from '@/store/user/selectors';
import { cleanObject } from '@/utils/object';

import { discoverService } from './discover';

// ============================================================
// Module Mocks
// ============================================================

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
      registerClientInMarketplace: { mutate: vi.fn() },
      registerM2MToken: { query: vi.fn() },
      reportMcpInstallResult: { mutate: vi.fn() },
      reportCall: { mutate: vi.fn() },
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

// ============================================================
// Helpers
// ============================================================

const mockLocale = 'en-US';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(globalHelpers, 'getCurrentLanguage').mockReturnValue(mockLocale);
  (useUserStore.getState as Mock).mockReturnValue({});
});

// ============================================================
// Tests
// ============================================================

describe('DiscoverService', () => {
  // ======================== Assistant Market ========================

  describe('getAssistantCategories', () => {
    it('should call lambdaClient with locale and no extra params by default', async () => {
      const mockCategories = [{ id: 'cat1', label: 'Category 1' }];
      vi.spyOn(lambdaClient.market.getAssistantCategories, 'query').mockResolvedValue(
        mockCategories as any,
      );

      const result = await discoverService.getAssistantCategories();

      expect(lambdaClient.market.getAssistantCategories.query).toHaveBeenCalledWith({
        locale: mockLocale,
        source: undefined,
      });
      expect(result).toEqual(mockCategories);
    });

    it('should forward source param when provided', async () => {
      vi.spyOn(lambdaClient.market.getAssistantCategories, 'query').mockResolvedValue([] as any);

      await discoverService.getAssistantCategories({ source: 'lobehub' } as any);

      expect(lambdaClient.market.getAssistantCategories.query).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'lobehub', locale: mockLocale }),
      );
    });
  });

  describe('getAssistantDetail', () => {
    it('should query with identifier, locale, and optional fields', async () => {
      const mockDetail = { identifier: 'assistant-1', name: 'Assistant 1' };
      vi.spyOn(lambdaClient.market.getAssistantDetail, 'query').mockResolvedValue(
        mockDetail as any,
      );

      const result = await discoverService.getAssistantDetail({
        identifier: 'assistant-1',
        version: '1.0',
        source: 'lobehub' as any,
      });

      expect(lambdaClient.market.getAssistantDetail.query).toHaveBeenCalledWith({
        identifier: 'assistant-1',
        locale: mockLocale,
        source: 'lobehub',
        version: '1.0',
      });
      expect(result).toEqual(mockDetail);
    });

    it('should use current language as locale', async () => {
      vi.spyOn(globalHelpers, 'getCurrentLanguage').mockReturnValue('zh-CN');
      vi.spyOn(lambdaClient.market.getAssistantDetail, 'query').mockResolvedValue(undefined);

      await discoverService.getAssistantDetail({ identifier: 'assistant-1' });

      expect(lambdaClient.market.getAssistantDetail.query).toHaveBeenCalledWith(
        expect.objectContaining({ locale: 'zh-CN' }),
      );
    });
  });

  describe('getAssistantIdentifiers', () => {
    it('should call query with empty params by default', async () => {
      const mockResponse = { identifiers: ['id1', 'id2'] };
      vi.spyOn(lambdaClient.market.getAssistantIdentifiers, 'query').mockResolvedValue(
        mockResponse as any,
      );

      const result = await discoverService.getAssistantIdentifiers();

      expect(lambdaClient.market.getAssistantIdentifiers.query).toHaveBeenCalledWith({});
      expect(result).toEqual(mockResponse);
    });

    it('should pass source param when provided', async () => {
      vi.spyOn(lambdaClient.market.getAssistantIdentifiers, 'query').mockResolvedValue({} as any);

      await discoverService.getAssistantIdentifiers({ source: 'lobehub' } as any);

      expect(lambdaClient.market.getAssistantIdentifiers.query).toHaveBeenCalledWith({
        source: 'lobehub',
      });
    });
  });

  describe('getAssistantList', () => {
    it('should use default page=1 and pageSize=20 when not provided', async () => {
      const mockList = { items: [], total: 0 };
      vi.spyOn(lambdaClient.market.getAssistantList, 'query').mockResolvedValue(mockList as any);

      const result = await discoverService.getAssistantList();

      expect(lambdaClient.market.getAssistantList.query).toHaveBeenCalledWith(
        { locale: mockLocale, page: 1, pageSize: 20 },
        { context: { showNotification: false } },
      );
      expect(result).toEqual(mockList);
    });

    it('should convert page and pageSize from string to number', async () => {
      vi.spyOn(lambdaClient.market.getAssistantList, 'query').mockResolvedValue({} as any);

      await discoverService.getAssistantList({ page: '3' as any, pageSize: '15' as any });

      expect(lambdaClient.market.getAssistantList.query).toHaveBeenCalledWith(
        expect.objectContaining({ page: 3, pageSize: 15 }),
        expect.any(Object),
      );
    });
  });

  // ======================== MCP Market ========================

  describe('getMcpCategories', () => {
    it('should include locale in query params', async () => {
      const mockCategories = [{ id: 'mcp-cat1' }];
      vi.spyOn(lambdaClient.market.getMcpCategories, 'query').mockResolvedValue(
        mockCategories as any,
      );

      const result = await discoverService.getMcpCategories();

      expect(lambdaClient.market.getMcpCategories.query).toHaveBeenCalledWith({
        locale: mockLocale,
      });
      expect(result).toEqual(mockCategories);
    });
  });

  describe('getMcpDetail', () => {
    it('should merge locale with provided params', async () => {
      const mockDetail = { identifier: 'mcp-1' };
      vi.spyOn(lambdaClient.market.getMcpDetail, 'query').mockResolvedValue(mockDetail as any);

      const result = await discoverService.getMcpDetail({
        identifier: 'mcp-1',
        version: '2.0',
      });

      expect(lambdaClient.market.getMcpDetail.query).toHaveBeenCalledWith({
        identifier: 'mcp-1',
        version: '2.0',
        locale: mockLocale,
      });
      expect(result).toEqual(mockDetail);
    });
  });

  describe('getMcpList', () => {
    it('should use default page=1 and pageSize=20', async () => {
      vi.spyOn(lambdaClient.market.getMcpList, 'query').mockResolvedValue({} as any);

      await discoverService.getMcpList();

      expect(lambdaClient.market.getMcpList.query).toHaveBeenCalledWith({
        locale: mockLocale,
        page: 1,
        pageSize: 20,
      });
    });

    it('should use provided page and pageSize values', async () => {
      vi.spyOn(lambdaClient.market.getMcpList, 'query').mockResolvedValue({} as any);

      await discoverService.getMcpList({ page: 2, pageSize: 10 });

      expect(lambdaClient.market.getMcpList.query).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 10 }),
      );
    });
  });

  describe('getMCPPluginList', () => {
    it('should use default pageSize=21 (not 20)', async () => {
      vi.spyOn(lambdaClient.market.getMcpList, 'query').mockResolvedValue({} as any);
      vi.spyOn(lambdaClient.market.registerM2MToken, 'query').mockResolvedValue({
        success: true,
      } as any);
      vi.spyOn(lambdaClient.market.registerClientInMarketplace, 'mutate').mockResolvedValue({
        clientId: 'c1',
        clientSecret: 's1',
      } as any);

      // Stub localStorage as undefined to skip injectMPToken
      vi.stubGlobal('localStorage', undefined);

      await discoverService.getMCPPluginList({ page: 1, pageSize: 0 } as any);

      expect(lambdaClient.market.getMcpList.query).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 21 }),
      );

      vi.unstubAllGlobals();
    });

    it('should call injectMPToken before fetching list (when localStorage is undefined, returns early)', async () => {
      vi.spyOn(lambdaClient.market.getMcpList, 'query').mockResolvedValue({ items: [] } as any);
      vi.stubGlobal('localStorage', undefined);

      const result = await discoverService.getMCPPluginList({} as any);

      expect(result).toEqual({ items: [] });
      vi.unstubAllGlobals();
    });
  });

  describe('getMcpManifest', () => {
    it('should merge locale with params', async () => {
      const mockManifest = { name: 'test-manifest' };
      vi.spyOn(lambdaClient.market.getMcpManifest, 'query').mockResolvedValue(mockManifest as any);

      const result = await discoverService.getMcpManifest({ identifier: 'mcp-1', version: '1.0' });

      expect(lambdaClient.market.getMcpManifest.query).toHaveBeenCalledWith({
        identifier: 'mcp-1',
        version: '1.0',
        locale: mockLocale,
      });
      expect(result).toEqual(mockManifest);
    });
  });

  describe('getMCPPluginManifest', () => {
    it('should query with identifier, locale, and install option', async () => {
      const mockManifest = { name: 'plugin-manifest' };
      vi.spyOn(lambdaClient.market.getMcpManifest, 'query').mockResolvedValue(mockManifest as any);

      const result = await discoverService.getMCPPluginManifest('my-plugin', { install: true });

      expect(lambdaClient.market.getMcpManifest.query).toHaveBeenCalledWith({
        identifier: 'my-plugin',
        install: true,
        locale: mockLocale,
      });
      expect(result).toEqual(mockManifest);
    });

    it('should default install to undefined when options are empty', async () => {
      vi.spyOn(lambdaClient.market.getMcpManifest, 'query').mockResolvedValue({} as any);

      await discoverService.getMCPPluginManifest('plugin-2');

      expect(lambdaClient.market.getMcpManifest.query).toHaveBeenCalledWith(
        expect.objectContaining({ install: undefined }),
      );
    });
  });

  describe('registerClient', () => {
    it('should call registerClientInMarketplace mutate', async () => {
      const mockClientInfo = { clientId: 'client-1', clientSecret: 'secret-1' };
      vi.spyOn(lambdaClient.market.registerClientInMarketplace, 'mutate').mockResolvedValue(
        mockClientInfo as any,
      );

      const result = await discoverService.registerClient();

      expect(lambdaClient.market.registerClientInMarketplace.mutate).toHaveBeenCalledWith({});
      expect(result).toEqual(mockClientInfo);
    });
  });

  // ======================== Reporting ========================

  describe('reportMcpInstallResult', () => {
    it('should not report when user does not allow tracing', async () => {
      vi.spyOn(preferenceSelectors, 'userAllowTrace').mockReturnValue(false);

      await discoverService.reportMcpInstallResult({
        success: true,
        identifier: 'mcp-1',
      } as any);

      expect(lambdaClient.market.reportMcpInstallResult.mutate).not.toHaveBeenCalled();
    });

    it('should report when user allows tracing (success case)', async () => {
      vi.spyOn(preferenceSelectors, 'userAllowTrace').mockReturnValue(true);
      vi.spyOn(lambdaClient.market.reportMcpInstallResult, 'mutate').mockResolvedValue(
        undefined as any,
      );
      vi.stubGlobal('localStorage', undefined);

      await discoverService.reportMcpInstallResult({
        success: true,
        manifest: { name: 'test' } as any,
        identifier: 'mcp-1',
      } as any);

      expect(lambdaClient.market.reportMcpInstallResult.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );

      vi.unstubAllGlobals();
    });

    it('should include errorCode and errorMessage on failure', async () => {
      vi.spyOn(preferenceSelectors, 'userAllowTrace').mockReturnValue(true);
      vi.spyOn(lambdaClient.market.reportMcpInstallResult, 'mutate').mockResolvedValue(
        undefined as any,
      );
      vi.stubGlobal('localStorage', undefined);

      await discoverService.reportMcpInstallResult({
        success: false,
        errorCode: 'ERR_001',
        errorMessage: 'Something went wrong',
        identifier: 'mcp-1',
      } as any);

      expect(cleanObject).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errorCode: 'ERR_001',
          errorMessage: 'Something went wrong',
        }),
      );

      vi.unstubAllGlobals();
    });

    it('should clear errorCode and errorMessage on success', async () => {
      vi.spyOn(preferenceSelectors, 'userAllowTrace').mockReturnValue(true);
      vi.spyOn(lambdaClient.market.reportMcpInstallResult, 'mutate').mockResolvedValue(
        undefined as any,
      );
      vi.stubGlobal('localStorage', undefined);

      await discoverService.reportMcpInstallResult({
        success: true,
        errorCode: 'ERR_001',
        errorMessage: 'Should be ignored',
        manifest: { name: 'test' } as any,
        identifier: 'mcp-1',
      } as any);

      expect(cleanObject).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          errorCode: undefined,
          errorMessage: undefined,
        }),
      );

      vi.unstubAllGlobals();
    });
  });

  describe('reportPluginCall', () => {
    it('should not report when user does not allow tracing', async () => {
      vi.spyOn(preferenceSelectors, 'userAllowTrace').mockReturnValue(false);

      await discoverService.reportPluginCall({ identifier: 'plugin-1' } as any);

      expect(lambdaClient.market.reportCall.mutate).not.toHaveBeenCalled();
    });

    it('should report when user allows tracing', async () => {
      vi.spyOn(preferenceSelectors, 'userAllowTrace').mockReturnValue(true);
      vi.spyOn(lambdaClient.market.reportCall, 'mutate').mockResolvedValue(undefined as any);
      vi.stubGlobal('localStorage', undefined);

      await discoverService.reportPluginCall({ identifier: 'plugin-1', callCount: 5 } as any);

      expect(lambdaClient.market.reportCall.mutate).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });

  // ======================== Models ========================

  describe('getModelCategories', () => {
    it('should pass params directly without adding locale', async () => {
      const mockCategories = [{ id: 'model-cat' }];
      vi.spyOn(lambdaClient.market.getModelCategories, 'query').mockResolvedValue(
        mockCategories as any,
      );

      const result = await discoverService.getModelCategories();

      expect(lambdaClient.market.getModelCategories.query).toHaveBeenCalledWith({});
      expect(result).toEqual(mockCategories);
    });
  });

  describe('getModelDetail', () => {
    it('should merge locale with identifier', async () => {
      const mockDetail = { identifier: 'gpt-4' };
      vi.spyOn(lambdaClient.market.getModelDetail, 'query').mockResolvedValue(mockDetail as any);

      const result = await discoverService.getModelDetail({ identifier: 'gpt-4' });

      expect(lambdaClient.market.getModelDetail.query).toHaveBeenCalledWith({
        identifier: 'gpt-4',
        locale: mockLocale,
      });
      expect(result).toEqual(mockDetail);
    });
  });

  describe('getModelIdentifiers', () => {
    it('should call query without params', async () => {
      const mockIdentifiers = { identifiers: ['gpt-4', 'claude-3'] };
      vi.spyOn(lambdaClient.market.getModelIdentifiers, 'query').mockResolvedValue(
        mockIdentifiers as any,
      );

      const result = await discoverService.getModelIdentifiers();

      expect(lambdaClient.market.getModelIdentifiers.query).toHaveBeenCalledWith();
      expect(result).toEqual(mockIdentifiers);
    });
  });

  describe('getModelList', () => {
    it('should use default page=1 and pageSize=20', async () => {
      vi.spyOn(lambdaClient.market.getModelList, 'query').mockResolvedValue({} as any);

      await discoverService.getModelList();

      expect(lambdaClient.market.getModelList.query).toHaveBeenCalledWith({
        locale: mockLocale,
        page: 1,
        pageSize: 20,
      });
    });

    it('should convert string page/pageSize to numbers', async () => {
      vi.spyOn(lambdaClient.market.getModelList, 'query').mockResolvedValue({} as any);

      await discoverService.getModelList({ page: '5' as any, pageSize: '25' as any });

      expect(lambdaClient.market.getModelList.query).toHaveBeenCalledWith(
        expect.objectContaining({ page: 5, pageSize: 25 }),
      );
    });
  });

  // ======================== Plugin Market ========================

  describe('getPluginCategories', () => {
    it('should include locale in query', async () => {
      vi.spyOn(lambdaClient.market.getPluginCategories, 'query').mockResolvedValue([] as any);

      await discoverService.getPluginCategories();

      expect(lambdaClient.market.getPluginCategories.query).toHaveBeenCalledWith({
        locale: mockLocale,
      });
    });
  });

  describe('getPluginDetail', () => {
    it('should merge locale with params', async () => {
      const mockDetail = { identifier: 'plugin-x' };
      vi.spyOn(lambdaClient.market.getPluginDetail, 'query').mockResolvedValue(mockDetail as any);

      const result = await discoverService.getPluginDetail({
        identifier: 'plugin-x',
        withManifest: true,
      });

      expect(lambdaClient.market.getPluginDetail.query).toHaveBeenCalledWith({
        identifier: 'plugin-x',
        withManifest: true,
        locale: mockLocale,
      });
      expect(result).toEqual(mockDetail);
    });
  });

  describe('getPluginIdentifiers', () => {
    it('should call query without params', async () => {
      vi.spyOn(lambdaClient.market.getPluginIdentifiers, 'query').mockResolvedValue({} as any);

      await discoverService.getPluginIdentifiers();

      expect(lambdaClient.market.getPluginIdentifiers.query).toHaveBeenCalledWith();
    });
  });

  describe('getPluginList', () => {
    it('should use default page=1 and pageSize=20', async () => {
      vi.spyOn(lambdaClient.market.getPluginList, 'query').mockResolvedValue({} as any);

      await discoverService.getPluginList();

      expect(lambdaClient.market.getPluginList.query).toHaveBeenCalledWith({
        locale: mockLocale,
        page: 1,
        pageSize: 20,
      });
    });
  });

  // ======================== Providers ========================

  describe('getProviderDetail', () => {
    it('should merge locale and withReadme with identifier', async () => {
      const mockDetail = { identifier: 'openai' };
      vi.spyOn(lambdaClient.market.getProviderDetail, 'query').mockResolvedValue(mockDetail as any);

      const result = await discoverService.getProviderDetail({
        identifier: 'openai',
        withReadme: true,
      });

      expect(lambdaClient.market.getProviderDetail.query).toHaveBeenCalledWith({
        identifier: 'openai',
        withReadme: true,
        locale: mockLocale,
      });
      expect(result).toEqual(mockDetail);
    });
  });

  describe('getProviderIdentifiers', () => {
    it('should call query without params', async () => {
      vi.spyOn(lambdaClient.market.getProviderIdentifiers, 'query').mockResolvedValue({} as any);

      await discoverService.getProviderIdentifiers();

      expect(lambdaClient.market.getProviderIdentifiers.query).toHaveBeenCalledWith();
    });
  });

  describe('getProviderList', () => {
    it('should use default page=1 and pageSize=20', async () => {
      vi.spyOn(lambdaClient.market.getProviderList, 'query').mockResolvedValue({} as any);

      await discoverService.getProviderList();

      expect(lambdaClient.market.getProviderList.query).toHaveBeenCalledWith({
        locale: mockLocale,
        page: 1,
        pageSize: 20,
      });
    });

    it('should forward extra query params', async () => {
      vi.spyOn(lambdaClient.market.getProviderList, 'query').mockResolvedValue({} as any);

      await discoverService.getProviderList({ page: 2, pageSize: 5, category: 'ai' } as any);

      expect(lambdaClient.market.getProviderList.query).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 5, category: 'ai', locale: mockLocale }),
      );
    });
  });

  // ======================== injectMPToken ========================

  describe('injectMPToken', () => {
    it('should return early when localStorage is undefined', async () => {
      vi.stubGlobal('localStorage', undefined);

      await discoverService.injectMPToken();

      expect(lambdaClient.market.registerClientInMarketplace.mutate).not.toHaveBeenCalled();
      expect(lambdaClient.market.registerM2MToken.query).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('should return early when token status cookie is "active"', async () => {
      const mockLocalStorage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
      vi.stubGlobal('localStorage', mockLocalStorage);

      // Set cookie to simulate active status
      Object.defineProperty(document, 'cookie', {
        value: 'mp_token_status=active',
        writable: true,
        configurable: true,
      });

      await discoverService.injectMPToken();

      expect(lambdaClient.market.registerM2MToken.query).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('should register new client when no stored credentials exist', async () => {
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      vi.stubGlobal('localStorage', mockLocalStorage);

      Object.defineProperty(document, 'cookie', {
        value: '',
        writable: true,
        configurable: true,
      });

      vi.spyOn(lambdaClient.market.registerClientInMarketplace, 'mutate').mockResolvedValue({
        clientId: 'new-client',
        clientSecret: 'new-secret',
      } as any);
      vi.spyOn(lambdaClient.market.registerM2MToken, 'query').mockResolvedValue({
        success: true,
      } as any);

      await discoverService.injectMPToken();

      expect(lambdaClient.market.registerClientInMarketplace.mutate).toHaveBeenCalledWith({});
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        '_mpc',
        expect.any(String), // base64 encoded
      );
      expect(lambdaClient.market.registerM2MToken.query).toHaveBeenCalledWith({
        clientId: 'new-client',
        clientSecret: 'new-secret',
      });

      vi.unstubAllGlobals();
    });

    it('should decode stored credentials from localStorage when they exist', async () => {
      const storedData = { clientId: 'stored-client', clientSecret: 'stored-secret' };
      const encoded = btoa(JSON.stringify(storedData));

      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue(encoded),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      vi.stubGlobal('localStorage', mockLocalStorage);

      Object.defineProperty(document, 'cookie', {
        value: '',
        writable: true,
        configurable: true,
      });

      vi.spyOn(lambdaClient.market.registerM2MToken, 'query').mockResolvedValue({
        success: true,
      } as any);

      await discoverService.injectMPToken();

      expect(lambdaClient.market.registerClientInMarketplace.mutate).not.toHaveBeenCalled();
      expect(lambdaClient.market.registerM2MToken.query).toHaveBeenCalledWith({
        clientId: 'stored-client',
        clientSecret: 'stored-secret',
      });

      vi.unstubAllGlobals();
    });

    it('should re-register when stored credentials cannot be decoded', async () => {
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue('invalid-base64!!!'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      vi.stubGlobal('localStorage', mockLocalStorage);

      Object.defineProperty(document, 'cookie', {
        value: '',
        writable: true,
        configurable: true,
      });

      vi.spyOn(lambdaClient.market.registerClientInMarketplace, 'mutate').mockResolvedValue({
        clientId: 're-registered-client',
        clientSecret: 're-registered-secret',
      } as any);
      vi.spyOn(lambdaClient.market.registerM2MToken, 'query').mockResolvedValue({
        success: true,
      } as any);

      await discoverService.injectMPToken();

      expect(lambdaClient.market.registerClientInMarketplace.mutate).toHaveBeenCalled();
      expect(mockLocalStorage.setItem).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('should clear localStorage and retry when token registration fails', async () => {
      const storedData = { clientId: 'bad-client', clientSecret: 'bad-secret' };
      const encoded = btoa(JSON.stringify(storedData));

      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue(encoded),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      vi.stubGlobal('localStorage', mockLocalStorage);

      Object.defineProperty(document, 'cookie', {
        value: '',
        writable: true,
        configurable: true,
      });

      // First call fails, second (retry) call succeeds
      vi.spyOn(lambdaClient.market.registerM2MToken, 'query')
        .mockResolvedValueOnce({ success: false } as any)
        .mockResolvedValueOnce({ success: true } as any);

      await discoverService.injectMPToken();

      // localStorage item should be cleared
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('_mpc');
      // registerM2MToken should be called twice (original + retry)
      expect(lambdaClient.market.registerM2MToken.query).toHaveBeenCalledTimes(2);

      vi.unstubAllGlobals();
    });

    it('should handle M2M token registration error gracefully', async () => {
      const storedData = { clientId: 'client-1', clientSecret: 'secret-1' };
      const encoded = btoa(JSON.stringify(storedData));

      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue(encoded),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      vi.stubGlobal('localStorage', mockLocalStorage);

      Object.defineProperty(document, 'cookie', {
        value: '',
        writable: true,
        configurable: true,
      });

      vi.spyOn(lambdaClient.market.registerM2MToken, 'query').mockRejectedValue(
        new Error('Network error'),
      );

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw
      await expect(discoverService.injectMPToken()).resolves.toBeNull();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to register M2M token:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
      vi.unstubAllGlobals();
    });
  });

  // ======================== getTokenStatusFromCookie (via injectMPToken) ========================

  describe('getTokenStatusFromCookie (private)', () => {
    it('should proceed when cookie does not contain mp_token_status', async () => {
      const mockLocalStorage = {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      };
      vi.stubGlobal('localStorage', mockLocalStorage);

      // We test this indirectly via injectMPToken:
      // When cookie has no mp_token_status, the method should proceed
      Object.defineProperty(document, 'cookie', {
        value: 'other_cookie=value',
        writable: true,
        configurable: true,
      });

      vi.spyOn(lambdaClient.market.registerClientInMarketplace, 'mutate').mockResolvedValue({
        clientId: 'c',
        clientSecret: 's',
      } as any);
      vi.spyOn(lambdaClient.market.registerM2MToken, 'query').mockResolvedValue({
        success: true,
      } as any);

      // Should proceed past the cookie check (mp_token_status not found)
      await discoverService.injectMPToken();

      expect(lambdaClient.market.registerM2MToken.query).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });
});
