import { beforeEach, describe, expect, it, vi } from 'vitest';

import { githubService } from '../github';

// Mock window.open to prevent actual browser navigation
const mockWindowOpen = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('open', mockWindowOpen);
});

describe('GitHubService', () => {
  describe('submitDBV1UpgradeError', () => {
    it('should open a GitHub issue URL with correct migration error title', () => {
      const error = { message: 'Column does not exist' };

      githubService.submitDBV1UpgradeError(1, error);

      expect(mockWindowOpen).toHaveBeenCalledOnce();
      const [url, target] = mockWindowOpen.mock.calls[0];
      expect(target).toBe('_blank');
      expect(url).toContain('github.com');
      expect(url).toContain('issues/new');
      expect(url).toContain(encodeURIComponent('[Migration Error V1]'));
      expect(url).toContain(encodeURIComponent('Column does not exist'));
    });

    it('should include the version number in the title', () => {
      const error = { message: 'Some error' };

      githubService.submitDBV1UpgradeError(42, error);

      expect(mockWindowOpen).toHaveBeenCalledOnce();
      const [url] = mockWindowOpen.mock.calls[0];
      expect(url).toContain(encodeURIComponent('[Migration Error V42]'));
    });

    it('should include the Database Migration Error label', () => {
      githubService.submitDBV1UpgradeError(1, { message: 'test' });

      const [url] = mockWindowOpen.mock.calls[0];
      expect(url).toContain(encodeURIComponent('❌ Database Migration Error'));
    });

    it('should include the error body as JSON in a code block', () => {
      const error = { message: 'Test error message' };

      githubService.submitDBV1UpgradeError(1, error);

      const [url] = mockWindowOpen.mock.calls[0];
      expect(url).toContain(encodeURIComponent('```json'));
      expect(url).toContain(encodeURIComponent(JSON.stringify(error, null, 2)));
    });

    it('should handle undefined error gracefully', () => {
      githubService.submitDBV1UpgradeError(1, undefined);

      expect(mockWindowOpen).toHaveBeenCalledOnce();
      const [url] = mockWindowOpen.mock.calls[0];
      expect(url).toContain('github.com');
      expect(url).toContain('issues/new');
      // Title should have empty message part
      expect(url).toContain(encodeURIComponent('[Migration Error V1]'));
    });

    it('should handle error with empty message', () => {
      githubService.submitDBV1UpgradeError(1, { message: '' });

      expect(mockWindowOpen).toHaveBeenCalledOnce();
      const [url] = mockWindowOpen.mock.calls[0];
      expect(url).toContain('github.com');
    });

    it('should open URL in a new tab', () => {
      githubService.submitDBV1UpgradeError(1, { message: 'error' });

      expect(mockWindowOpen).toHaveBeenCalledWith(expect.any(String), '_blank');
    });
  });

  describe('submitImportError', () => {
    it('should open a GitHub issue URL with correct import error title', () => {
      const error = { message: 'Invalid JSON format' };

      githubService.submitImportError(error);

      expect(mockWindowOpen).toHaveBeenCalledOnce();
      const [url, target] = mockWindowOpen.mock.calls[0];
      expect(target).toBe('_blank');
      expect(url).toContain('github.com');
      expect(url).toContain('issues/new');
      expect(url).toContain(encodeURIComponent('[Config Import Error]'));
      expect(url).toContain(encodeURIComponent('Invalid JSON format'));
    });

    it('should include the Config Import Error label', () => {
      githubService.submitImportError({ message: 'test' });

      const [url] = mockWindowOpen.mock.calls[0];
      expect(url).toContain(encodeURIComponent('❌ Import Config Error'));
    });

    it('should include the error body as JSON code block', () => {
      const error = { message: 'Import failed' };

      githubService.submitImportError(error);

      const [url] = mockWindowOpen.mock.calls[0];
      expect(url).toContain(encodeURIComponent('```json'));
      expect(url).toContain(encodeURIComponent(JSON.stringify(error, null, 2)));
    });

    it('should handle undefined error gracefully', () => {
      githubService.submitImportError(undefined);

      expect(mockWindowOpen).toHaveBeenCalledOnce();
      const [url] = mockWindowOpen.mock.calls[0];
      expect(url).toContain('github.com');
      expect(url).toContain('issues/new');
    });

    it('should open URL in a new tab', () => {
      githubService.submitImportError({ message: 'error' });

      expect(mockWindowOpen).toHaveBeenCalledWith(expect.any(String), '_blank');
    });
  });

  describe('submitPgliteInitError', () => {
    it('should open a GitHub issue URL with correct database init error title', () => {
      const error = { message: 'Failed to initialize PGLite' };

      githubService.submitPgliteInitError(error);

      expect(mockWindowOpen).toHaveBeenCalledOnce();
      const [url, target] = mockWindowOpen.mock.calls[0];
      expect(target).toBe('_blank');
      expect(url).toContain('github.com');
      expect(url).toContain('issues/new');
      expect(url).toContain(encodeURIComponent('[Database Init Error]'));
      expect(url).toContain(encodeURIComponent('Failed to initialize PGLite'));
    });

    it('should include the Database Init Error label', () => {
      githubService.submitPgliteInitError({ message: 'test' });

      const [url] = mockWindowOpen.mock.calls[0];
      expect(url).toContain(encodeURIComponent('❌ Database Init Error'));
    });

    it('should include the error body as JSON code block', () => {
      const error = { message: 'Init failed' };

      githubService.submitPgliteInitError(error);

      const [url] = mockWindowOpen.mock.calls[0];
      expect(url).toContain(encodeURIComponent('```json'));
      expect(url).toContain(encodeURIComponent(JSON.stringify(error, null, 2)));
    });

    it('should handle undefined error gracefully', () => {
      githubService.submitPgliteInitError(undefined);

      expect(mockWindowOpen).toHaveBeenCalledOnce();
      const [url] = mockWindowOpen.mock.calls[0];
      expect(url).toContain('github.com');
      expect(url).toContain('issues/new');
    });

    it('should open URL in a new tab', () => {
      githubService.submitPgliteInitError({ message: 'error' });

      expect(mockWindowOpen).toHaveBeenCalledWith(expect.any(String), '_blank');
    });
  });

  describe('URL structure', () => {
    it('should use the correct GitHub base URL for all methods', () => {
      githubService.submitDBV1UpgradeError(1, { message: 'e' });
      githubService.submitImportError({ message: 'e' });
      githubService.submitPgliteInitError({ message: 'e' });

      for (const call of mockWindowOpen.mock.calls) {
        const [url] = call;
        expect(url).toContain('github.com');
        expect(url).toContain('issues/new');
      }
    });

    it('each method should produce distinct issue labels', () => {
      githubService.submitDBV1UpgradeError(1, { message: 'e' });
      githubService.submitImportError({ message: 'e' });
      githubService.submitPgliteInitError({ message: 'e' });

      const [dbUrl] = mockWindowOpen.mock.calls[0];
      const [importUrl] = mockWindowOpen.mock.calls[1];
      const [pgliteUrl] = mockWindowOpen.mock.calls[2];

      expect(dbUrl).toContain(encodeURIComponent('❌ Database Migration Error'));
      expect(importUrl).toContain(encodeURIComponent('❌ Import Config Error'));
      expect(pgliteUrl).toContain(encodeURIComponent('❌ Database Init Error'));
    });
  });
});
