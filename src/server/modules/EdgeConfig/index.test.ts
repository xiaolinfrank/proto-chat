import { createClient } from '@vercel/edge-config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appEnv } from '@/envs/app';

import { EdgeConfig } from './index';

// Mock dependencies
vi.mock('@vercel/edge-config', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/envs/app', () => ({
  appEnv: {
    VERCEL_EDGE_CONFIG: 'https://edge-config.vercel.com/test-config-id?token=test-token',
  },
}));

describe('EdgeConfig', () => {
  let edgeConfig: EdgeConfig;
  let mockClient: {
    get: ReturnType<typeof vi.fn>;
    getAll: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock client
    mockClient = {
      get: vi.fn(),
      getAll: vi.fn(),
    };

    vi.mocked(createClient).mockReturnValue(mockClient as any);

    edgeConfig = new EdgeConfig();
  });

  describe('client', () => {
    it('should create client with VERCEL_EDGE_CONFIG env var', () => {
      // Access the client getter
      const client = edgeConfig.client;

      expect(createClient).toHaveBeenCalledWith(
        'https://edge-config.vercel.com/test-config-id?token=test-token',
      );
      expect(client).toBe(mockClient);
    });

    it('should throw error when VERCEL_EDGE_CONFIG is not set', () => {
      const originalValue = appEnv.VERCEL_EDGE_CONFIG;
      vi.mocked(appEnv).VERCEL_EDGE_CONFIG = '';

      expect(() => {
        edgeConfig.client;
      }).toThrow('VERCEL_EDGE_CONFIG is not set');

      // Restore
      vi.mocked(appEnv).VERCEL_EDGE_CONFIG = originalValue;
    });

    it('should throw error when VERCEL_EDGE_CONFIG is undefined', () => {
      const originalValue = appEnv.VERCEL_EDGE_CONFIG;
      vi.mocked(appEnv).VERCEL_EDGE_CONFIG = undefined as any;

      expect(() => {
        edgeConfig.client;
      }).toThrow('VERCEL_EDGE_CONFIG is not set');

      // Restore
      vi.mocked(appEnv).VERCEL_EDGE_CONFIG = originalValue;
    });
  });

  describe('isEnabled', () => {
    it('should return true when VERCEL_EDGE_CONFIG is set', () => {
      const result = EdgeConfig.isEnabled();
      expect(result).toBe(true);
    });

    it('should return false when VERCEL_EDGE_CONFIG is empty string', () => {
      const originalValue = appEnv.VERCEL_EDGE_CONFIG;
      vi.mocked(appEnv).VERCEL_EDGE_CONFIG = '';

      const result = EdgeConfig.isEnabled();
      expect(result).toBe(false);

      // Restore
      vi.mocked(appEnv).VERCEL_EDGE_CONFIG = originalValue;
    });

    it('should return false when VERCEL_EDGE_CONFIG is undefined', () => {
      const originalValue = appEnv.VERCEL_EDGE_CONFIG;
      vi.mocked(appEnv).VERCEL_EDGE_CONFIG = undefined as any;

      const result = EdgeConfig.isEnabled();
      expect(result).toBe(false);

      // Restore
      vi.mocked(appEnv).VERCEL_EDGE_CONFIG = originalValue;
    });

    it('should return false when VERCEL_EDGE_CONFIG is null', () => {
      const originalValue = appEnv.VERCEL_EDGE_CONFIG;
      vi.mocked(appEnv).VERCEL_EDGE_CONFIG = null as any;

      const result = EdgeConfig.isEnabled();
      expect(result).toBe(false);

      // Restore
      vi.mocked(appEnv).VERCEL_EDGE_CONFIG = originalValue;
    });
  });

  describe('getAgentRestrictions', () => {
    it('should retrieve both blacklist and whitelist from Edge Config', async () => {
      const mockBlacklist = ['agent-1', 'agent-2', 'agent-3'];
      const mockWhitelist = ['agent-4', 'agent-5'];

      mockClient.getAll.mockResolvedValue({
        assistant_blacklist: mockBlacklist,
        assistant_whitelist: mockWhitelist,
      });

      const result = await edgeConfig.getAgentRestrictions();

      expect(mockClient.getAll).toHaveBeenCalledWith([
        'assistant_blacklist',
        'assistant_whitelist',
      ]);
      expect(result).toEqual({
        blacklist: mockBlacklist,
        whitelist: mockWhitelist,
      });
    });

    it('should handle undefined blacklist', async () => {
      mockClient.getAll.mockResolvedValue({
        assistant_blacklist: undefined,
        assistant_whitelist: ['agent-1'],
      });

      const result = await edgeConfig.getAgentRestrictions();

      expect(result).toEqual({
        blacklist: undefined,
        whitelist: ['agent-1'],
      });
    });

    it('should handle undefined whitelist', async () => {
      mockClient.getAll.mockResolvedValue({
        assistant_blacklist: ['agent-1'],
        assistant_whitelist: undefined,
      });

      const result = await edgeConfig.getAgentRestrictions();

      expect(result).toEqual({
        blacklist: ['agent-1'],
        whitelist: undefined,
      });
    });

    it('should handle both lists being undefined', async () => {
      mockClient.getAll.mockResolvedValue({
        assistant_blacklist: undefined,
        assistant_whitelist: undefined,
      });

      const result = await edgeConfig.getAgentRestrictions();

      expect(result).toEqual({
        blacklist: undefined,
        whitelist: undefined,
      });
    });

    it('should handle empty arrays', async () => {
      mockClient.getAll.mockResolvedValue({
        assistant_blacklist: [],
        assistant_whitelist: [],
      });

      const result = await edgeConfig.getAgentRestrictions();

      expect(result).toEqual({
        blacklist: [],
        whitelist: [],
      });
    });

    it('should handle Edge Config API errors', async () => {
      mockClient.getAll.mockRejectedValue(new Error('Edge Config API error'));

      await expect(edgeConfig.getAgentRestrictions()).rejects.toThrow('Edge Config API error');
      expect(mockClient.getAll).toHaveBeenCalledWith([
        'assistant_blacklist',
        'assistant_whitelist',
      ]);
    });

    it('should handle network errors', async () => {
      mockClient.getAll.mockRejectedValue(new Error('Network request failed'));

      await expect(edgeConfig.getAgentRestrictions()).rejects.toThrow('Network request failed');
    });
  });

  describe('getFeatureFlags', () => {
    it('should retrieve feature flags from Edge Config', async () => {
      const mockFeatureFlags = {
        enableNewUI: true,
        experimentalFeatures: ['feature-1', 'feature-2'],
        debugMode: false,
      };

      mockClient.get.mockResolvedValue(mockFeatureFlags);

      const result = await edgeConfig.getFeatureFlags();

      expect(mockClient.get).toHaveBeenCalledWith('feature_flags');
      expect(result).toEqual(mockFeatureFlags);
    });

    it('should handle undefined feature flags', async () => {
      mockClient.get.mockResolvedValue(undefined);

      const result = await edgeConfig.getFeatureFlags();

      expect(mockClient.get).toHaveBeenCalledWith('feature_flags');
      expect(result).toBeUndefined();
    });

    it('should handle empty feature flags object', async () => {
      mockClient.get.mockResolvedValue({});

      const result = await edgeConfig.getFeatureFlags();

      expect(result).toEqual({});
    });

    it('should handle boolean feature flags', async () => {
      const mockFeatureFlags = {
        darkMode: true,
        betaAccess: false,
        premiumFeatures: true,
      };

      mockClient.get.mockResolvedValue(mockFeatureFlags);

      const result = await edgeConfig.getFeatureFlags();

      expect(result).toEqual(mockFeatureFlags);
    });

    it('should handle string array feature flags', async () => {
      const mockFeatureFlags = {
        enabledRegions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
        allowedDomains: ['example.com', 'test.com'],
      };

      mockClient.get.mockResolvedValue(mockFeatureFlags);

      const result = await edgeConfig.getFeatureFlags();

      expect(result).toEqual(mockFeatureFlags);
    });

    it('should handle mixed feature flags types', async () => {
      const mockFeatureFlags = {
        enabled: true,
        regions: ['us-east-1', 'eu-west-1'],
        version: '2.0',
        disabled: false,
      };

      mockClient.get.mockResolvedValue(mockFeatureFlags);

      const result = await edgeConfig.getFeatureFlags();

      expect(result).toEqual(mockFeatureFlags);
    });

    it('should handle Edge Config API errors', async () => {
      mockClient.get.mockRejectedValue(new Error('Edge Config API error'));

      await expect(edgeConfig.getFeatureFlags()).rejects.toThrow('Edge Config API error');
      expect(mockClient.get).toHaveBeenCalledWith('feature_flags');
    });

    it('should handle network timeout errors', async () => {
      mockClient.get.mockRejectedValue(new Error('Request timeout'));

      await expect(edgeConfig.getFeatureFlags()).rejects.toThrow('Request timeout');
    });

    it('should handle invalid response format', async () => {
      mockClient.get.mockResolvedValue(null);

      const result = await edgeConfig.getFeatureFlags();

      expect(result).toBeNull();
    });
  });

  describe('getValue (private method)', () => {
    it('should call client.get with the correct key', async () => {
      const mockValue = ['item-1', 'item-2'];
      mockClient.get.mockResolvedValue(mockValue);

      const result = await edgeConfig['getValue']('assistant_blacklist');

      expect(mockClient.get).toHaveBeenCalledWith('assistant_blacklist');
      expect(result).toEqual(mockValue);
    });

    it('should handle feature_flags key', async () => {
      const mockFeatureFlags = { flag1: true };
      mockClient.get.mockResolvedValue(mockFeatureFlags);

      const result = await edgeConfig['getValue']('feature_flags');

      expect(mockClient.get).toHaveBeenCalledWith('feature_flags');
      expect(result).toEqual(mockFeatureFlags);
    });
  });

  describe('getValues (private method)', () => {
    it('should call client.getAll with the correct keys', async () => {
      const mockValues = {
        assistant_blacklist: ['agent-1'],
        assistant_whitelist: ['agent-2'],
      };
      mockClient.getAll.mockResolvedValue(mockValues);

      const result = await edgeConfig['getValues'](['assistant_blacklist', 'assistant_whitelist']);

      expect(mockClient.getAll).toHaveBeenCalledWith([
        'assistant_blacklist',
        'assistant_whitelist',
      ]);
      expect(result).toEqual(mockValues);
    });

    it('should handle single key in array', async () => {
      const mockValue = { feature_flags: { enabled: true } };
      mockClient.getAll.mockResolvedValue(mockValue);

      const result = await edgeConfig['getValues'](['feature_flags']);

      expect(mockClient.getAll).toHaveBeenCalledWith(['feature_flags']);
      expect(result).toEqual(mockValue);
    });
  });

  describe('integration scenarios', () => {
    it('should support checking enabled status before using the service', () => {
      const isEnabled = EdgeConfig.isEnabled();

      if (isEnabled) {
        const client = edgeConfig.client;
        expect(client).toBeDefined();
      }
    });

    it('should handle multiple sequential calls to getFeatureFlags', async () => {
      const mockFlags1 = { feature1: true };
      const mockFlags2 = { feature2: false };

      mockClient.get.mockResolvedValueOnce(mockFlags1).mockResolvedValueOnce(mockFlags2);

      const result1 = await edgeConfig.getFeatureFlags();
      const result2 = await edgeConfig.getFeatureFlags();

      expect(result1).toEqual(mockFlags1);
      expect(result2).toEqual(mockFlags2);
      expect(mockClient.get).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent calls to getAgentRestrictions and getFeatureFlags', async () => {
      mockClient.getAll.mockResolvedValue({
        assistant_blacklist: ['agent-1'],
        assistant_whitelist: ['agent-2'],
      });
      mockClient.get.mockResolvedValue({ enabled: true });

      const [restrictions, flags] = await Promise.all([
        edgeConfig.getAgentRestrictions(),
        edgeConfig.getFeatureFlags(),
      ]);

      expect(restrictions).toEqual({
        blacklist: ['agent-1'],
        whitelist: ['agent-2'],
      });
      expect(flags).toEqual({ enabled: true });
    });

    it('should properly recreate client on each access', () => {
      vi.mocked(createClient).mockClear();

      // Access client multiple times
      edgeConfig.client;
      edgeConfig.client;
      edgeConfig.client;

      // createClient should be called each time due to getter
      expect(createClient).toHaveBeenCalledTimes(3);
    });
  });
});
