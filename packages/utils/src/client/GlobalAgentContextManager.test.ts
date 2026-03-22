import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { globalAgentContextManager } from './GlobalAgentContextManager';

describe('GlobalAgentContextManager', () => {
  beforeEach(() => {
    // Reset context before each test
    globalAgentContextManager.setContext({});
  });

  afterEach(() => {
    // Clean up after each test
    globalAgentContextManager.setContext({});
  });

  describe('getContext', () => {
    it('should return an empty object by default', () => {
      const context = globalAgentContextManager.getContext();
      expect(context).toEqual({});
    });

    it('should return the current context after setting it', () => {
      const newContext = { homePath: '/home/user', currentTime: '2026-03-22' };
      globalAgentContextManager.setContext(newContext);
      expect(globalAgentContextManager.getContext()).toEqual(newContext);
    });
  });

  describe('setContext', () => {
    it('should replace the entire context', () => {
      globalAgentContextManager.setContext({ homePath: '/home/user', downloadsPath: '/home/user/Downloads' });
      globalAgentContextManager.setContext({ currentTime: '10:00 AM' });

      const context = globalAgentContextManager.getContext();
      expect(context).toEqual({ currentTime: '10:00 AM' });
      expect(context.homePath).toBeUndefined();
    });

    it('should accept all valid context properties', () => {
      const fullContext = {
        currentTime: '10:00 AM',
        desktopPath: '/home/user/Desktop',
        documentsPath: '/home/user/Documents',
        downloadsPath: '/home/user/Downloads',
        homePath: '/home/user',
        musicPath: '/home/user/Music',
        picturesPath: '/home/user/Pictures',
        userDataPath: '/home/user/.config/app',
        videosPath: '/home/user/Videos',
      };
      globalAgentContextManager.setContext(fullContext);
      expect(globalAgentContextManager.getContext()).toEqual(fullContext);
    });
  });

  describe('updateContext', () => {
    it('should merge updates into existing context', () => {
      globalAgentContextManager.setContext({ homePath: '/home/user' });
      globalAgentContextManager.updateContext({ currentTime: '10:00 AM' });

      const context = globalAgentContextManager.getContext();
      expect(context.homePath).toBe('/home/user');
      expect(context.currentTime).toBe('10:00 AM');
    });

    it('should overwrite existing keys', () => {
      globalAgentContextManager.setContext({ homePath: '/home/old' });
      globalAgentContextManager.updateContext({ homePath: '/home/new' });

      expect(globalAgentContextManager.getContext().homePath).toBe('/home/new');
    });

    it('should handle empty updates without changing context', () => {
      globalAgentContextManager.setContext({ homePath: '/home/user' });
      globalAgentContextManager.updateContext({});

      expect(globalAgentContextManager.getContext()).toEqual({ homePath: '/home/user' });
    });

    it('should accumulate multiple updates', () => {
      globalAgentContextManager.updateContext({ homePath: '/home/user' });
      globalAgentContextManager.updateContext({ downloadsPath: '/home/user/Downloads' });
      globalAgentContextManager.updateContext({ currentTime: 'noon' });

      const context = globalAgentContextManager.getContext();
      expect(context.homePath).toBe('/home/user');
      expect(context.downloadsPath).toBe('/home/user/Downloads');
      expect(context.currentTime).toBe('noon');
    });
  });

  describe('fillTemplate', () => {
    beforeEach(() => {
      globalAgentContextManager.setContext({
        homePath: '/home/user',
        downloadsPath: '/home/user/Downloads',
        currentTime: '2026-03-22 10:00',
      });
    });

    it('should return empty string for undefined template', () => {
      expect(globalAgentContextManager.fillTemplate(undefined)).toBe('');
    });

    it('should return empty string for empty template', () => {
      expect(globalAgentContextManager.fillTemplate('')).toBe('');
    });

    it('should replace a single placeholder with context value', () => {
      const result = globalAgentContextManager.fillTemplate('Home: {{homePath}}');
      expect(result).toBe('Home: /home/user');
    });

    it('should replace multiple placeholders', () => {
      const result = globalAgentContextManager.fillTemplate(
        'Home: {{homePath}}, Downloads: {{downloadsPath}}',
      );
      expect(result).toBe('Home: /home/user, Downloads: /home/user/Downloads');
    });

    it('should replace [N/A] for unknown placeholders', () => {
      const result = globalAgentContextManager.fillTemplate('Unknown: {{unknownKey}}');
      expect(result).toBe('Unknown: [N/A]');
    });

    it('should handle templates without placeholders', () => {
      const result = globalAgentContextManager.fillTemplate('No placeholders here');
      expect(result).toBe('No placeholders here');
    });

    it('should handle placeholder with spaces around key', () => {
      const result = globalAgentContextManager.fillTemplate('Home: {{ homePath }}');
      expect(result).toBe('Home: /home/user');
    });

    it('should replace multiple occurrences of the same placeholder', () => {
      const result = globalAgentContextManager.fillTemplate(
        '{{homePath}} and {{homePath}} again',
      );
      expect(result).toBe('/home/user and /home/user again');
    });

    it('should handle currentTime placeholder', () => {
      const result = globalAgentContextManager.fillTemplate('Time: {{currentTime}}');
      expect(result).toBe('Time: 2026-03-22 10:00');
    });

    it('should return [N/A] for keys not in context', () => {
      globalAgentContextManager.setContext({});
      const result = globalAgentContextManager.fillTemplate('{{homePath}}');
      expect(result).toBe('[N/A]');
    });
  });
});
