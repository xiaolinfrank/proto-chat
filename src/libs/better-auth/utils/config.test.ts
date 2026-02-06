import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RedisConfig } from '@/libs/redis/types';

import { createSecondaryStorage, getTrustedOrigins, normalizeOrigin } from './config';

// Mock dependencies
vi.mock('@/envs/auth', () => {
  const mockAuthEnv = {
    AUTH_TRUSTED_ORIGINS: undefined as string | undefined,
    NEXT_PUBLIC_AUTH_URL: 'https://example.com',
  };
  return {
    authEnv: mockAuthEnv,
  };
});

vi.mock('@/envs/redis', () => ({
  getRedisConfig: vi.fn(),
}));

vi.mock('@/libs/redis', () => ({
  initializeRedis: vi.fn(),
  isRedisEnabled: vi.fn(),
}));

vi.mock('@/utils/env', () => ({
  isDev: false,
}));

describe('normalizeOrigin', () => {
  it('should return undefined for undefined input', () => {
    expect(normalizeOrigin(undefined)).toBeUndefined();
  });

  it('should return undefined for empty string', () => {
    expect(normalizeOrigin('')).toBeUndefined();
  });

  it('should preserve custom schemes', () => {
    expect(normalizeOrigin('com.lobehub.app://')).toBe('com.lobehub.app://');
    expect(normalizeOrigin('myapp://callback')).toBe('myapp://callback');
    expect(normalizeOrigin('exp://192.168.1.1:8081')).toBe('exp://192.168.1.1:8081');
  });

  it('should normalize http URLs to origins', () => {
    expect(normalizeOrigin('http://example.com')).toBe('http://example.com');
    expect(normalizeOrigin('http://example.com/path')).toBe('http://example.com');
    expect(normalizeOrigin('http://example.com:3000')).toBe('http://example.com:3000');
  });

  it('should normalize https URLs to origins', () => {
    expect(normalizeOrigin('https://example.com')).toBe('https://example.com');
    expect(normalizeOrigin('https://example.com/path')).toBe('https://example.com');
    expect(normalizeOrigin('https://example.com:3000')).toBe('https://example.com:3000');
  });

  it('should add https prefix to URLs without protocol', () => {
    expect(normalizeOrigin('example.com')).toBe('https://example.com');
    expect(normalizeOrigin('api.example.com')).toBe('https://api.example.com');
    expect(normalizeOrigin('localhost:3000')).toBe('https://localhost:3000');
  });

  it('should return undefined for invalid URLs', () => {
    expect(normalizeOrigin('not a valid url')).toBeUndefined();
  });

  it('should handle URLs with paths and query parameters', () => {
    expect(normalizeOrigin('https://example.com/path?query=1')).toBe('https://example.com');
  });

  it('should handle URLs with userinfo', () => {
    expect(normalizeOrigin('https://user:pass@example.com')).toBe('https://example.com');
  });
});

describe('getTrustedOrigins', () => {
  let mockAuthEnv: any;

  beforeEach(async () => {
    vi.resetModules();
    // Reset environment
    process.env.APP_URL = undefined;
    process.env.VERCEL_BRANCH_URL = undefined;
    process.env.VERCEL_URL = undefined;

    // Get the mocked authEnv object
    const authModule = await import('@/envs/auth');
    mockAuthEnv = authModule.authEnv;
  });

  it('should return origins from AUTH_TRUSTED_ORIGINS env when set', async () => {
    mockAuthEnv.AUTH_TRUSTED_ORIGINS = 'https://example.com,https://api.example.com';

    const result = getTrustedOrigins([]);

    expect(result).toEqual(['https://example.com', 'https://api.example.com']);
    mockAuthEnv.AUTH_TRUSTED_ORIGINS = undefined;
  });

  it('should handle custom schemes in AUTH_TRUSTED_ORIGINS', async () => {
    mockAuthEnv.AUTH_TRUSTED_ORIGINS = 'https://example.com,com.lobehub.app://';

    const result = getTrustedOrigins([]);

    expect(result).toEqual(['https://example.com', 'com.lobehub.app://']);
    mockAuthEnv.AUTH_TRUSTED_ORIGINS = undefined;
  });

  it('should trim whitespace from AUTH_TRUSTED_ORIGINS entries', async () => {
    mockAuthEnv.AUTH_TRUSTED_ORIGINS = ' https://example.com , https://api.example.com ';

    const result = getTrustedOrigins([]);

    expect(result).toEqual(['https://example.com', 'https://api.example.com']);
    mockAuthEnv.AUTH_TRUSTED_ORIGINS = undefined;
  });

  it('should filter out invalid origins from AUTH_TRUSTED_ORIGINS', async () => {
    mockAuthEnv.AUTH_TRUSTED_ORIGINS = 'https://example.com,invalid url,https://api.example.com';

    const result = getTrustedOrigins([]);

    expect(result).toEqual(['https://example.com', 'https://api.example.com']);
    mockAuthEnv.AUTH_TRUSTED_ORIGINS = undefined;
  });

  it('should deduplicate origins', async () => {
    mockAuthEnv.AUTH_TRUSTED_ORIGINS = 'https://example.com,https://example.com,https://api.example.com';

    const result = getTrustedOrigins([]);

    expect(result).toEqual(['https://example.com', 'https://api.example.com']);
    mockAuthEnv.AUTH_TRUSTED_ORIGINS = undefined;
  });

  it('should include Apple trusted origin when apple provider is enabled', async () => {
    mockAuthEnv.AUTH_TRUSTED_ORIGINS = undefined;
    mockAuthEnv.NEXT_PUBLIC_AUTH_URL = 'https://example.com';

    const result = getTrustedOrigins(['apple']);

    expect(result).toContain('https://appleid.apple.com');
  });

  it('should not include Apple trusted origin when apple provider is not enabled', async () => {
    mockAuthEnv.AUTH_TRUSTED_ORIGINS = undefined;
    mockAuthEnv.NEXT_PUBLIC_AUTH_URL = 'https://example.com';

    const result = getTrustedOrigins(['google', 'github']);

    expect(result).not.toContain('https://appleid.apple.com');
  });

  it('should include mobile app scheme in defaults', async () => {
    mockAuthEnv.AUTH_TRUSTED_ORIGINS = undefined;

    const result = getTrustedOrigins([]);

    expect(result).toContain('com.lobehub.app://');
  });

  it('should normalize APP_URL from process.env', async () => {
    mockAuthEnv.AUTH_TRUSTED_ORIGINS = undefined;
    process.env.APP_URL = 'api.example.com';

    const result = getTrustedOrigins([]);

    expect(result).toContain('https://api.example.com');
  });
});

describe('createSecondaryStorage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return undefined when Redis is not enabled', async () => {
    const { getRedisConfig } = await import('@/envs/redis');
    const { isRedisEnabled } = await import('@/libs/redis');
    const mockRedisConfig: RedisConfig = {
      enabled: false,
      prefix: 'test:',
      provider: false,
    };

    vi.mocked(getRedisConfig).mockReturnValue(mockRedisConfig);
    vi.mocked(isRedisEnabled).mockReturnValue(false);

    const storage = createSecondaryStorage();

    expect(storage).toBeUndefined();
  });

  it('should return storage object when Redis is enabled', async () => {
    const { getRedisConfig } = await import('@/envs/redis');
    const { isRedisEnabled } = await import('@/libs/redis');
    const mockRedisConfig: RedisConfig = {
      enabled: true,
      prefix: 'test:',
      provider: 'redis',
      tls: false,
      url: 'redis://localhost:6379',
    };

    vi.mocked(getRedisConfig).mockReturnValue(mockRedisConfig);
    vi.mocked(isRedisEnabled).mockReturnValue(true);

    const storage = createSecondaryStorage();

    expect(storage).toBeDefined();
    expect(storage).toHaveProperty('get');
    expect(storage).toHaveProperty('set');
    expect(storage).toHaveProperty('delete');
  });

  it('should prefix keys with "better-auth:" when storing', async () => {
    const { getRedisConfig } = await import('@/envs/redis');
    const { initializeRedis, isRedisEnabled } = await import('@/libs/redis');
    const mockRedisConfig: RedisConfig = {
      enabled: true,
      prefix: 'test:',
      provider: 'redis',
      tls: false,
      url: 'redis://localhost:6379',
    };
    const mockRedisClient = {
      del: vi.fn(),
      get: vi.fn().mockResolvedValue('test-value'),
      set: vi.fn(),
    };

    vi.mocked(getRedisConfig).mockReturnValue(mockRedisConfig);
    vi.mocked(isRedisEnabled).mockReturnValue(true);
    vi.mocked(initializeRedis).mockResolvedValue(mockRedisClient as any);

    const storage = createSecondaryStorage();
    await storage?.get('test-key');

    expect(mockRedisClient.get).toHaveBeenCalledWith('better-auth:test-key');
  });

  it('should set value without TTL', async () => {
    const { getRedisConfig } = await import('@/envs/redis');
    const { initializeRedis, isRedisEnabled } = await import('@/libs/redis');
    const mockRedisConfig: RedisConfig = {
      enabled: true,
      prefix: 'test:',
      provider: 'redis',
      tls: false,
      url: 'redis://localhost:6379',
    };
    const mockRedisClient = {
      del: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
    };

    vi.mocked(getRedisConfig).mockReturnValue(mockRedisConfig);
    vi.mocked(isRedisEnabled).mockReturnValue(true);
    vi.mocked(initializeRedis).mockResolvedValue(mockRedisClient as any);

    const storage = createSecondaryStorage();
    await storage?.set('test-key', 'test-value');

    expect(mockRedisClient.set).toHaveBeenCalledWith('better-auth:test-key', 'test-value');
  });

  it('should set value with TTL', async () => {
    const { getRedisConfig } = await import('@/envs/redis');
    const { initializeRedis, isRedisEnabled } = await import('@/libs/redis');
    const mockRedisConfig: RedisConfig = {
      enabled: true,
      prefix: 'test:',
      provider: 'redis',
      tls: false,
      url: 'redis://localhost:6379',
    };
    const mockRedisClient = {
      del: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
    };

    vi.mocked(getRedisConfig).mockReturnValue(mockRedisConfig);
    vi.mocked(isRedisEnabled).mockReturnValue(true);
    vi.mocked(initializeRedis).mockResolvedValue(mockRedisClient as any);

    const storage = createSecondaryStorage();
    await storage?.set('test-key', 'test-value', 3600);

    expect(mockRedisClient.set).toHaveBeenCalledWith('better-auth:test-key', 'test-value', { ex: 3600 });
  });

  it('should delete value with prefixed key', async () => {
    const { getRedisConfig } = await import('@/envs/redis');
    const { initializeRedis, isRedisEnabled } = await import('@/libs/redis');
    const mockRedisConfig: RedisConfig = {
      enabled: true,
      prefix: 'test:',
      provider: 'redis',
      tls: false,
      url: 'redis://localhost:6379',
    };
    const mockRedisClient = {
      del: vi.fn(),
      get: vi.fn(),
      set: vi.fn(),
    };

    vi.mocked(getRedisConfig).mockReturnValue(mockRedisConfig);
    vi.mocked(isRedisEnabled).mockReturnValue(true);
    vi.mocked(initializeRedis).mockResolvedValue(mockRedisClient as any);

    const storage = createSecondaryStorage();
    await storage?.delete('test-key');

    expect(mockRedisClient.del).toHaveBeenCalledWith('better-auth:test-key');
  });

  it('should return null when get returns undefined', async () => {
    const { getRedisConfig } = await import('@/envs/redis');
    const { initializeRedis, isRedisEnabled } = await import('@/libs/redis');
    const mockRedisConfig: RedisConfig = {
      enabled: true,
      prefix: 'test:',
      provider: 'redis',
      tls: false,
      url: 'redis://localhost:6379',
    };
    const mockRedisClient = {
      del: vi.fn(),
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn(),
    };

    vi.mocked(getRedisConfig).mockReturnValue(mockRedisConfig);
    vi.mocked(isRedisEnabled).mockReturnValue(true);
    vi.mocked(initializeRedis).mockResolvedValue(mockRedisClient as any);

    const storage = createSecondaryStorage();
    const result = await storage?.get('test-key');

    expect(result).toBeNull();
  });

  it('should throw error when Redis client fails to initialize', async () => {
    const { getRedisConfig } = await import('@/envs/redis');
    const { initializeRedis, isRedisEnabled } = await import('@/libs/redis');
    const mockRedisConfig: RedisConfig = {
      enabled: true,
      prefix: 'test:',
      provider: 'redis',
      tls: false,
      url: 'redis://localhost:6379',
    };

    vi.mocked(getRedisConfig).mockReturnValue(mockRedisConfig);
    vi.mocked(isRedisEnabled).mockReturnValue(true);
    vi.mocked(initializeRedis).mockResolvedValue(null);

    const storage = createSecondaryStorage();

    await expect(storage?.get('test-key')).rejects.toThrow(
      'Redis secondary storage is enabled but failed to initialize',
    );
  });
});
