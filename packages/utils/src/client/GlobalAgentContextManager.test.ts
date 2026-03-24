import { beforeEach, describe, expect, it } from 'vitest';

import {
  type LobeGlobalAgentContext,
  globalAgentContextManager,
} from './GlobalAgentContextManager';

const CONTEXT_KEY = '__LOBE_GLOBAL_AGENT_CONTEXT__';

describe('GlobalAgentContextManager', () => {
  beforeEach(() => {
    // Reset the global context before each test
    (window as any)[CONTEXT_KEY] = undefined;
  });

  describe('getContext', () => {
    it('should return empty object when no context is set', () => {
      const ctx = globalAgentContextManager.getContext();
      expect(ctx).toEqual({});
    });

    it('should return the current context', () => {
      (window as any)[CONTEXT_KEY] = { homePath: '/home/user', currentTime: '2024-01-01' };
      const ctx = globalAgentContextManager.getContext();
      expect(ctx).toEqual({ homePath: '/home/user', currentTime: '2024-01-01' });
    });
  });

  describe('setContext', () => {
    it('should replace the entire context', () => {
      globalAgentContextManager.setContext({ homePath: '/home/user' });
      expect(globalAgentContextManager.getContext()).toEqual({ homePath: '/home/user' });
    });

    it('should overwrite existing context completely', () => {
      globalAgentContextManager.setContext({ homePath: '/home/user', currentTime: '2024-01-01' });
      globalAgentContextManager.setContext({ downloadsPath: '/downloads' });
      expect(globalAgentContextManager.getContext()).toEqual({ downloadsPath: '/downloads' });
    });

    it('should set context to empty object', () => {
      globalAgentContextManager.setContext({ homePath: '/home/user' });
      globalAgentContextManager.setContext({});
      expect(globalAgentContextManager.getContext()).toEqual({});
    });
  });

  describe('updateContext', () => {
    it('should merge updates into existing context', () => {
      globalAgentContextManager.setContext({ homePath: '/home/user' });
      globalAgentContextManager.updateContext({ currentTime: '2024-01-01' });
      expect(globalAgentContextManager.getContext()).toEqual({
        currentTime: '2024-01-01',
        homePath: '/home/user',
      });
    });

    it('should override existing keys with update values', () => {
      globalAgentContextManager.setContext({ homePath: '/home/user' });
      globalAgentContextManager.updateContext({ homePath: '/home/newuser' });
      expect(globalAgentContextManager.getContext()).toEqual({ homePath: '/home/newuser' });
    });

    it('should handle updating with empty object', () => {
      globalAgentContextManager.setContext({ homePath: '/home/user' });
      globalAgentContextManager.updateContext({});
      expect(globalAgentContextManager.getContext()).toEqual({ homePath: '/home/user' });
    });

    it('should work on initially empty context', () => {
      globalAgentContextManager.updateContext({ desktopPath: '/desktop' });
      expect(globalAgentContextManager.getContext()).toEqual({ desktopPath: '/desktop' });
    });

    it('should accumulate multiple updates', () => {
      globalAgentContextManager.updateContext({ homePath: '/home/user' });
      globalAgentContextManager.updateContext({ currentTime: '2024-01-01' });
      globalAgentContextManager.updateContext({ downloadsPath: '/downloads' });
      expect(globalAgentContextManager.getContext()).toEqual({
        currentTime: '2024-01-01',
        downloadsPath: '/downloads',
        homePath: '/home/user',
      });
    });
  });

  describe('fillTemplate', () => {
    beforeEach(() => {
      globalAgentContextManager.setContext({
        currentTime: '2024-01-01',
        desktopPath: '/home/user/Desktop',
        documentsPath: '/home/user/Documents',
        homePath: '/home/user',
      });
    });

    it('should return empty string for undefined template', () => {
      expect(globalAgentContextManager.fillTemplate(undefined)).toBe('');
    });

    it('should return empty string for empty template', () => {
      expect(globalAgentContextManager.fillTemplate('')).toBe('');
    });

    it('should return template unchanged when no placeholders', () => {
      const template = 'Hello, world!';
      expect(globalAgentContextManager.fillTemplate(template)).toBe('Hello, world!');
    });

    it('should replace a single placeholder with context value', () => {
      const template = 'Home: {{homePath}}';
      expect(globalAgentContextManager.fillTemplate(template)).toBe('Home: /home/user');
    });

    it('should replace multiple placeholders', () => {
      const template = 'Home: {{homePath}}, Time: {{currentTime}}';
      expect(globalAgentContextManager.fillTemplate(template)).toBe(
        'Home: /home/user, Time: 2024-01-01',
      );
    });

    it('should replace the same placeholder multiple times', () => {
      const template = '{{homePath}} and {{homePath}}';
      expect(globalAgentContextManager.fillTemplate(template)).toBe(
        '/home/user and /home/user',
      );
    });

    it('should replace placeholder with [N/A] for missing keys', () => {
      const template = 'Music: {{musicPath}}';
      expect(globalAgentContextManager.fillTemplate(template)).toBe('Music: [N/A]');
    });

    it('should handle mixed known and unknown placeholders', () => {
      const template = 'Home: {{homePath}}, Unknown: {{unknownKey}}';
      expect(globalAgentContextManager.fillTemplate(template)).toBe(
        'Home: /home/user, Unknown: [N/A]',
      );
    });

    it('should handle placeholders with extra whitespace', () => {
      const template = 'Home: {{ homePath }}';
      expect(globalAgentContextManager.fillTemplate(template)).toBe('Home: /home/user');
    });

    it('should handle template with only placeholders', () => {
      const template = '{{currentTime}}';
      expect(globalAgentContextManager.fillTemplate(template)).toBe('2024-01-01');
    });

    it('should not replace malformed placeholders (single braces)', () => {
      const template = 'Home: {homePath}';
      expect(globalAgentContextManager.fillTemplate(template)).toBe('Home: {homePath}');
    });

    it('should use updated context values after context change', () => {
      const template = 'Home: {{homePath}}';
      globalAgentContextManager.updateContext({ homePath: '/new/home' });
      expect(globalAgentContextManager.fillTemplate(template)).toBe('Home: /new/home');
    });
  });
});
