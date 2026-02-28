import { beforeEach, describe, expect, it, vi } from 'vitest';

import { githubService } from './github';

// Mock window.open
const mockWindowOpen = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  // Setup window.open mock
  global.window = { open: mockWindowOpen } as any;
});

describe('GitHubService', () => {
  describe('submitDBV1UpgradeError', () => {
    it('should open GitHub issue URL with correct parameters when error is provided', () => {
      // Arrange
      const version = 1;
      const error = { message: 'Database migration failed' };

      // Act
      githubService.submitDBV1UpgradeError(version, error);

      // Assert
      expect(mockWindowOpen).toHaveBeenCalledTimes(1);
      const calledUrl = mockWindowOpen.mock.calls[0][0];
      const calledTarget = mockWindowOpen.mock.calls[0][1];

      expect(calledTarget).toBe('_blank');
      expect(calledUrl).toContain('https://github.com/protochat/issues/new');
      expect(calledUrl).toContain('title=%5BMigration%20Error%20V1%5D%20Database%20migration%20failed');
      expect(calledUrl).toContain('labels=%E2%9D%8C%20Database%20Migration%20Error');
      expect(calledUrl).toContain('body=%60%60%60json');
    });

    it('should handle error object with message property', () => {
      // Arrange
      const version = 2;
      const error = { message: 'Schema update error' };

      // Act
      githubService.submitDBV1UpgradeError(version, error);

      // Assert
      const calledUrl = mockWindowOpen.mock.calls[0][0];
      expect(calledUrl).toContain('Schema%20update%20error');
    });

    it('should handle undefined error parameter', () => {
      // Arrange
      const version = 3;

      // Act
      githubService.submitDBV1UpgradeError(version, undefined);

      // Assert
      expect(mockWindowOpen).toHaveBeenCalledTimes(1);
      const calledUrl = mockWindowOpen.mock.calls[0][0];

      expect(calledUrl).toContain('title=%5BMigration%20Error%20V3%5D%20');
      expect(calledUrl).toContain('labels=%E2%9D%8C%20Database%20Migration%20Error');
    });

    it('should format error object as JSON in body', () => {
      // Arrange
      const version = 4;
      const error = { message: 'Complex error with details' };

      // Act
      githubService.submitDBV1UpgradeError(version, error);

      // Assert
      const calledUrl = mockWindowOpen.mock.calls[0][0];
      // URL should contain encoded JSON structure
      expect(calledUrl).toContain('%60%60%60json'); // ```json
      expect(calledUrl).toContain('%60%60%60'); // ```
    });

    it('should include version number in title', () => {
      // Arrange
      const version = 999;
      const error = { message: 'Test error' };

      // Act
      githubService.submitDBV1UpgradeError(version, error);

      // Assert
      const calledUrl = mockWindowOpen.mock.calls[0][0];
      expect(calledUrl).toContain('V999');
    });
  });

  describe('submitImportError', () => {
    it('should open GitHub issue URL with correct parameters when error is provided', () => {
      // Arrange
      const error = { message: 'Failed to import configuration' };

      // Act
      githubService.submitImportError(error);

      // Assert
      expect(mockWindowOpen).toHaveBeenCalledTimes(1);
      const calledUrl = mockWindowOpen.mock.calls[0][0];
      const calledTarget = mockWindowOpen.mock.calls[0][1];

      expect(calledTarget).toBe('_blank');
      expect(calledUrl).toContain('https://github.com/protochat/issues/new');
      expect(calledUrl).toContain('title=%5BConfig%20Import%20Error%5D%20Failed%20to%20import%20configuration');
      expect(calledUrl).toContain('labels=%E2%9D%8C%20Import%20Config%20Error');
      expect(calledUrl).toContain('body=%60%60%60json');
    });

    it('should handle undefined error parameter', () => {
      // Arrange & Act
      githubService.submitImportError(undefined);

      // Assert
      expect(mockWindowOpen).toHaveBeenCalledTimes(1);
      const calledUrl = mockWindowOpen.mock.calls[0][0];

      expect(calledUrl).toContain('title=%5BConfig%20Import%20Error%5D%20');
      expect(calledUrl).toContain('labels=%E2%9D%8C%20Import%20Config%20Error');
    });

    it('should format error object as JSON in body', () => {
      // Arrange
      const error = { message: 'Invalid JSON format' };

      // Act
      githubService.submitImportError(error);

      // Assert
      const calledUrl = mockWindowOpen.mock.calls[0][0];
      expect(calledUrl).toContain('%60%60%60json'); // ```json
      expect(calledUrl).toContain('%60%60%60'); // ```
    });

    it('should handle error with empty message', () => {
      // Arrange
      const error = { message: '' };

      // Act
      githubService.submitImportError(error);

      // Assert
      const calledUrl = mockWindowOpen.mock.calls[0][0];
      expect(calledUrl).toContain('title=%5BConfig%20Import%20Error%5D%20');
    });
  });

  describe('submitPgliteInitError', () => {
    it('should open GitHub issue URL with correct parameters when error is provided', () => {
      // Arrange
      const error = { message: 'PGLite initialization failed' };

      // Act
      githubService.submitPgliteInitError(error);

      // Assert
      expect(mockWindowOpen).toHaveBeenCalledTimes(1);
      const calledUrl = mockWindowOpen.mock.calls[0][0];
      const calledTarget = mockWindowOpen.mock.calls[0][1];

      expect(calledTarget).toBe('_blank');
      expect(calledUrl).toContain('https://github.com/protochat/issues/new');
      expect(calledUrl).toContain('title=%5BDatabase%20Init%20Error%5D%20PGLite%20initialization%20failed');
      expect(calledUrl).toContain('labels=%E2%9D%8C%20Database%20Init%20Error');
      expect(calledUrl).toContain('body=%60%60%60json');
    });

    it('should handle undefined error parameter', () => {
      // Arrange & Act
      githubService.submitPgliteInitError(undefined);

      // Assert
      expect(mockWindowOpen).toHaveBeenCalledTimes(1);
      const calledUrl = mockWindowOpen.mock.calls[0][0];

      expect(calledUrl).toContain('title=%5BDatabase%20Init%20Error%5D%20');
      expect(calledUrl).toContain('labels=%E2%9D%8C%20Database%20Init%20Error');
    });

    it('should format error object as JSON in body', () => {
      // Arrange
      const error = { message: 'WASM module load failed' };

      // Act
      githubService.submitPgliteInitError(error);

      // Assert
      const calledUrl = mockWindowOpen.mock.calls[0][0];
      expect(calledUrl).toContain('%60%60%60json'); // ```json
      expect(calledUrl).toContain('%60%60%60'); // ```
    });

    it('should handle complex error messages', () => {
      // Arrange
      const error = { message: 'Error: Cannot find module @electric-sql/pglite' };

      // Act
      githubService.submitPgliteInitError(error);

      // Assert
      const calledUrl = mockWindowOpen.mock.calls[0][0];
      expect(calledUrl).toContain('Cannot%20find%20module');
    });
  });

  describe('URL construction', () => {
    it('should properly encode special characters in error messages', () => {
      // Arrange
      const error = { message: 'Error with special chars: <>"#' };

      // Act
      githubService.submitImportError(error);

      // Assert
      const calledUrl = mockWindowOpen.mock.calls[0][0];
      // Special characters should be encoded in the title/body parameters
      // Check that raw special characters are not in the title parameter value
      const titleMatch = calledUrl.match(/title=([^&]*)/);
      expect(titleMatch).toBeTruthy();
      const titleValue = titleMatch![1];

      // These characters should be encoded, not appear as-is
      expect(titleValue).not.toContain('<');
      expect(titleValue).not.toContain('>');
      expect(titleValue).not.toContain('"');
      expect(titleValue).not.toContain('#');

      // Verify they are encoded
      expect(titleValue).toContain('%3C'); // <
      expect(titleValue).toContain('%3E'); // >
      expect(titleValue).toContain('%22'); // "
      expect(titleValue).toContain('%23'); // #
    });

    it('should create valid GitHub issues URL for all methods', () => {
      // Test all three methods create valid GitHub URLs
      githubService.submitDBV1UpgradeError(1, { message: 'test' });
      githubService.submitImportError({ message: 'test' });
      githubService.submitPgliteInitError({ message: 'test' });

      // Assert all three calls made valid URLs
      expect(mockWindowOpen).toHaveBeenCalledTimes(3);
      mockWindowOpen.mock.calls.forEach((call) => {
        const url = call[0];
        expect(url).toContain('https://github.com/protochat/issues/new');
        expect(url).toContain('?');
        expect(url).toContain('title=');
        expect(url).toContain('labels=');
        expect(url).toContain('body=');
      });
    });
  });
});
