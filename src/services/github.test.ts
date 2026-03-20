import { beforeEach, describe, expect, it, vi } from 'vitest';

import { githubService } from './github';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('open', vi.fn());
});

const getOpenedUrl = () => {
  const calls = (window.open as ReturnType<typeof vi.fn>).mock.calls;
  return decodeURIComponent(calls[0][0] as string);
};

const getOpenedTarget = () => {
  const calls = (window.open as ReturnType<typeof vi.fn>).mock.calls;
  return calls[0][1];
};

describe('GitHubService', () => {
  describe('submitDBV1UpgradeError', () => {
    it('should open a GitHub issue URL with correct structure', () => {
      githubService.submitDBV1UpgradeError(1, { message: 'column not found' });

      expect(window.open).toHaveBeenCalledOnce();
      const url = getOpenedUrl();
      expect(url).toContain('github.com');
      expect(url).toContain('/issues/new');
      expect(getOpenedTarget()).toBe('_blank');
    });

    it('should include version number and error message in title', () => {
      githubService.submitDBV1UpgradeError(1, { message: 'column not found' });

      const url = getOpenedUrl();
      expect(url).toContain('[Migration Error V1]');
      expect(url).toContain('column not found');
    });

    it('should include the database migration error label', () => {
      githubService.submitDBV1UpgradeError(1, { message: 'err' });

      const url = getOpenedUrl();
      expect(url).toContain('❌ Database Migration Error');
    });

    it('should handle empty error message', () => {
      githubService.submitDBV1UpgradeError(2, { message: '' });

      expect(window.open).toHaveBeenCalledOnce();
      const url = getOpenedUrl();
      expect(url).toContain('[Migration Error V2]');
    });

    it('should handle undefined error', () => {
      githubService.submitDBV1UpgradeError(3, undefined);

      expect(window.open).toHaveBeenCalledOnce();
      const url = getOpenedUrl();
      expect(url).toContain('[Migration Error V3]');
    });

    it('should serialize error object in the body', () => {
      githubService.submitDBV1UpgradeError(1, { message: 'syntax error' });

      const url = getOpenedUrl();
      expect(url).toContain('syntax error');
      expect(url).toContain('```json');
    });
  });

  describe('submitImportError', () => {
    it('should open a GitHub issue URL with correct structure', () => {
      githubService.submitImportError({ message: 'invalid JSON format' });

      expect(window.open).toHaveBeenCalledOnce();
      const url = getOpenedUrl();
      expect(url).toContain('github.com');
      expect(url).toContain('/issues/new');
      expect(getOpenedTarget()).toBe('_blank');
    });

    it('should include error message in title', () => {
      githubService.submitImportError({ message: 'invalid JSON format' });

      const url = getOpenedUrl();
      expect(url).toContain('[Config Import Error]');
      expect(url).toContain('invalid JSON format');
    });

    it('should include the import config error label', () => {
      githubService.submitImportError({ message: 'err' });

      const url = getOpenedUrl();
      expect(url).toContain('❌ Import Config Error');
    });

    it('should handle empty error message', () => {
      githubService.submitImportError({ message: '' });

      expect(window.open).toHaveBeenCalledOnce();
      const url = getOpenedUrl();
      expect(url).toContain('[Config Import Error]');
    });

    it('should handle undefined error', () => {
      githubService.submitImportError(undefined);

      expect(window.open).toHaveBeenCalledOnce();
      const url = getOpenedUrl();
      expect(url).toContain('[Config Import Error]');
    });

    it('should serialize error object in the body', () => {
      githubService.submitImportError({ message: 'file not found' });

      const url = getOpenedUrl();
      expect(url).toContain('file not found');
      expect(url).toContain('```json');
    });
  });

  describe('submitPgliteInitError', () => {
    it('should open a GitHub issue URL with correct structure', () => {
      githubService.submitPgliteInitError({ message: 'wasm init failed' });

      expect(window.open).toHaveBeenCalledOnce();
      const url = getOpenedUrl();
      expect(url).toContain('github.com');
      expect(url).toContain('/issues/new');
      expect(getOpenedTarget()).toBe('_blank');
    });

    it('should include error message in title', () => {
      githubService.submitPgliteInitError({ message: 'wasm init failed' });

      const url = getOpenedUrl();
      expect(url).toContain('[Database Init Error]');
      expect(url).toContain('wasm init failed');
    });

    it('should include the database init error label', () => {
      githubService.submitPgliteInitError({ message: 'err' });

      const url = getOpenedUrl();
      expect(url).toContain('❌ Database Init Error');
    });

    it('should handle empty error message', () => {
      githubService.submitPgliteInitError({ message: '' });

      expect(window.open).toHaveBeenCalledOnce();
      const url = getOpenedUrl();
      expect(url).toContain('[Database Init Error]');
    });

    it('should handle undefined error', () => {
      githubService.submitPgliteInitError(undefined);

      expect(window.open).toHaveBeenCalledOnce();
      const url = getOpenedUrl();
      expect(url).toContain('[Database Init Error]');
    });

    it('should serialize error object in the body', () => {
      githubService.submitPgliteInitError({ message: 'out of memory' });

      const url = getOpenedUrl();
      expect(url).toContain('out of memory');
      expect(url).toContain('```json');
    });
  });
});
