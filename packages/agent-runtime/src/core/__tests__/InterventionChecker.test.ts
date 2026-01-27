import type { HumanInterventionConfig, SecurityBlacklistConfig } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { InterventionChecker } from '../InterventionChecker';
import { DEFAULT_SECURITY_BLACKLIST } from '../defaultSecurityBlacklist';

describe('InterventionChecker', () => {
  describe('shouldIntervene', () => {
    it('should return never when config is undefined', () => {
      const result = InterventionChecker.shouldIntervene({
        config: undefined,
        securityBlacklist: [], // Disable blacklist for this test
        toolArgs: {},
      });
      expect(result).toBe('never');
    });

    it('should return the policy when config is a simple string', () => {
      expect(
        InterventionChecker.shouldIntervene({
          config: 'never',
          securityBlacklist: [], // Disable blacklist for this test
          toolArgs: {},
        }),
      ).toBe('never');
      expect(
        InterventionChecker.shouldIntervene({
          config: 'required',
          securityBlacklist: [], // Disable blacklist for this test
          toolArgs: {},
        }),
      ).toBe('required');
    });

    it('should match rules in order and return first match', () => {
      const config: HumanInterventionConfig = [
        { match: { command: 'ls:*' }, policy: 'never' },
        { match: { command: 'git commit:*' }, policy: 'required' },
        { policy: 'required' }, // Default rule
      ];

      expect(
        InterventionChecker.shouldIntervene({
          config,
          securityBlacklist: [], // Disable blacklist for this test
          toolArgs: { command: 'ls:' },
        }),
      ).toBe('never');
      expect(
        InterventionChecker.shouldIntervene({
          config,
          securityBlacklist: [], // Disable blacklist for this test
          toolArgs: { command: 'git commit:' },
        }),
      ).toBe('required');
      expect(
        InterventionChecker.shouldIntervene({
          config,
          securityBlacklist: [], // Disable blacklist for this test
          toolArgs: { command: 'rm -rf /' },
        }),
      ).toBe('required');
    });

    it('should return require as default when no rule matches', () => {
      const config: HumanInterventionConfig = [{ match: { command: 'ls:*' }, policy: 'never' }];

      const result = InterventionChecker.shouldIntervene({
        config,
        securityBlacklist: [], // Disable blacklist for this test
        toolArgs: { command: 'rm -rf /' },
      });
      expect(result).toBe('required');
    });

    it('should handle multiple parameter matching', () => {
      const config: HumanInterventionConfig = [
        {
          match: {
            command: 'git add:*',
            path: '/Users/project/*',
          },
          policy: 'never',
        },
        { policy: 'required' },
      ];

      // Both match
      expect(
        InterventionChecker.shouldIntervene({
          config,
          securityBlacklist: [], // Disable blacklist for this test
          toolArgs: {
            command: 'git add:.',
            path: '/Users/project/file.ts',
          },
        }),
      ).toBe('never');

      // Only one matches
      expect(
        InterventionChecker.shouldIntervene({
          config,
          securityBlacklist: [], // Disable blacklist for this test
          toolArgs: {
            command: 'git add:.',
            path: '/tmp/file.ts',
          },
        }),
      ).toBe('required');
    });

    it('should handle default rule without match', () => {
      const config: HumanInterventionConfig = [
        { match: { command: 'ls:*' }, policy: 'never' },
        { policy: 'required' }, // Default rule
      ];

      const result = InterventionChecker.shouldIntervene({
        config,
        securityBlacklist: [], // Disable blacklist for this test
        toolArgs: { command: 'anything' },
      });
      expect(result).toBe('required');
    });
  });

  describe('matchPattern', () => {
    it('should match exact strings', () => {
      expect(InterventionChecker['matchPattern']('hello', 'hello')).toBe(true);
      expect(InterventionChecker['matchPattern']('hello', 'world')).toBe(false);
    });

    it('should match wildcard patterns', () => {
      expect(InterventionChecker['matchPattern']('*.ts', 'file.ts')).toBe(true);
      expect(InterventionChecker['matchPattern']('*.ts', 'file.js')).toBe(false);
      expect(InterventionChecker['matchPattern']('test*', 'test123')).toBe(true);
      expect(InterventionChecker['matchPattern']('test*', 'abc123')).toBe(false);
    });

    it('should match colon-based prefix patterns', () => {
      expect(InterventionChecker['matchPattern']('git add:*', 'git add:')).toBe(true);
      expect(InterventionChecker['matchPattern']('git add:*', 'git add:.')).toBe(true);
      expect(InterventionChecker['matchPattern']('git add:*', 'git add:--all')).toBe(true);
      expect(InterventionChecker['matchPattern']('git add:*', 'git commit')).toBe(false);
    });

    it('should match path patterns', () => {
      expect(
        InterventionChecker['matchPattern']('/Users/project/*', '/Users/project/file.ts'),
      ).toBe(true);
      expect(InterventionChecker['matchPattern']('/Users/project/*', '/tmp/file.ts')).toBe(false);
    });
  });

  describe('matchesArgument', () => {
    it('should match exact type', () => {
      const matcher = { pattern: 'git add', type: 'exact' as const };
      expect(InterventionChecker['matchesArgument'](matcher, 'git add')).toBe(true);
      expect(InterventionChecker['matchesArgument'](matcher, 'git add:.')).toBe(false);
    });

    it('should match prefix type', () => {
      const matcher = { pattern: 'git add', type: 'prefix' as const };
      expect(InterventionChecker['matchesArgument'](matcher, 'git add')).toBe(true);
      expect(InterventionChecker['matchesArgument'](matcher, 'git add:.')).toBe(true);
      expect(InterventionChecker['matchesArgument'](matcher, 'git commit')).toBe(false);
    });

    it('should match wildcard type', () => {
      const matcher = { pattern: 'git *', type: 'wildcard' as const };
      expect(InterventionChecker['matchesArgument'](matcher, 'git add')).toBe(true);
      expect(InterventionChecker['matchesArgument'](matcher, 'git commit')).toBe(true);
      expect(InterventionChecker['matchesArgument'](matcher, 'npm install')).toBe(false);
    });

    it('should match regex type', () => {
      const matcher = { pattern: '^git (add|commit)', type: 'regex' as const };
      expect(InterventionChecker['matchesArgument'](matcher, 'git add')).toBe(true);
      expect(InterventionChecker['matchesArgument'](matcher, 'git commit')).toBe(true);
      expect(InterventionChecker['matchesArgument'](matcher, 'git push')).toBe(false);
    });

    it('should handle simple string matcher', () => {
      expect(InterventionChecker['matchesArgument']('git add:*', 'git add:.')).toBe(true);
      expect(InterventionChecker['matchesArgument']('*.ts', 'file.ts')).toBe(true);
      expect(InterventionChecker['matchesArgument']('exact', 'exact')).toBe(true);
    });
  });

  describe('generateToolKey', () => {
    it('should generate key without args hash', () => {
      const key = InterventionChecker.generateToolKey('web-browsing', 'crawlSinglePage');
      expect(key).toBe('web-browsing/crawlSinglePage');
    });

    it('should generate key with args hash', () => {
      const key = InterventionChecker.generateToolKey('bash', 'bash', 'a1b2c3');
      expect(key).toBe('bash/bash#a1b2c3');
    });
  });

  describe('hashArguments', () => {
    it('should generate consistent hash for same arguments', () => {
      const args1 = { command: 'ls -la', path: '/tmp' };
      const args2 = { command: 'ls -la', path: '/tmp' };

      const hash1 = InterventionChecker.hashArguments(args1);
      const hash2 = InterventionChecker.hashArguments(args2);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different arguments', () => {
      const args1 = { command: 'ls -la' };
      const args2 = { command: 'ls -l' };

      const hash1 = InterventionChecker.hashArguments(args1);
      const hash2 = InterventionChecker.hashArguments(args2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle key order independence', () => {
      const args1 = { a: 1, b: 2 };
      const args2 = { b: 2, a: 1 };

      const hash1 = InterventionChecker.hashArguments(args1);
      const hash2 = InterventionChecker.hashArguments(args2);

      expect(hash1).toBe(hash2);
    });

    it('should handle empty arguments', () => {
      const hash = InterventionChecker.hashArguments({});
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });

    it('should handle complex nested objects', () => {
      const args = {
        config: { nested: { value: 'test' } },
        array: [1, 2, 3],
      };

      const hash = InterventionChecker.hashArguments(args);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
    });
  });

  describe('checkSecurityBlacklist', () => {
    it('should return not blocked when blacklist is empty', () => {
      const result = InterventionChecker.checkSecurityBlacklist([], { command: 'rm -rf /' });
      expect(result.blocked).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    describe('with DEFAULT_SECURITY_BLACKLIST', () => {
      it('should block dangerous rm -rf ~/ command', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'rm -rf ~/',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('Recursive deletion of home directory is extremely dangerous');
      });

      it('should block rm -rf on macOS home directory', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'rm -rf /Users/alice',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('Recursive deletion of home directory is extremely dangerous');
      });

      it('should block rm -rf on Linux home directory', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'rm -rf /home/alice',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('Recursive deletion of home directory is extremely dangerous');
      });

      it('should block rm -rf with $HOME variable', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'rm -rf $HOME',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('Recursive deletion of home directory is extremely dangerous');
      });

      it('should block rm -rf / command', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'rm -rf /',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('Recursive deletion of root directory will destroy the system');
      });

      it('should allow safe rm commands', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'rm -rf /tmp/test-folder',
        });
        expect(result.blocked).toBe(false);
      });

      it('should block fork bomb', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: ':(){ :|:& };:',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('Fork bomb can crash the system');
      });

      it('should block dangerous dd commands to disk devices', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'dd if=/dev/zero of=/dev/sda',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('Writing random data to disk devices can destroy data');
      });

      it('should block reading .env files via command', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'cat .env',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe(
          'Reading .env files may leak sensitive credentials and API keys',
        );
      });

      it('should block reading .env files via path', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          path: '/project/.env.local',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe(
          'Reading .env files may leak sensitive credentials and API keys',
        );
      });

      it('should block reading SSH private keys via command', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'cat ~/.ssh/id_rsa',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('Reading SSH private keys can compromise system security');
      });

      it('should block reading SSH private keys via path', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          path: '/home/user/.ssh/id_ed25519',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('Reading SSH private keys can compromise system security');
      });

      it('should allow reading SSH public keys', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'cat ~/.ssh/id_rsa.pub',
        });
        expect(result.blocked).toBe(false);
      });

      it('should block reading AWS credentials via command', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'cat ~/.aws/credentials',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('Accessing AWS credentials can leak cloud access keys');
      });

      it('should block reading AWS credentials via path', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          path: '/home/user/.aws/credentials',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('Accessing AWS credentials can leak cloud access keys');
      });

      it('should block reading Docker config', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'less ~/.docker/config.json',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('Reading Docker config may expose registry credentials');
      });

      it('should block reading Kubernetes config', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          path: '/home/user/.kube/config',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('Reading Kubernetes config may expose cluster credentials');
      });

      it('should block reading Git credentials', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'cat ~/.git-credentials',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('Reading Git credentials file may leak access tokens');
      });

      it('should block reading npm token file', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          path: '/home/user/.npmrc',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe(
          'Reading npm token file may expose package registry credentials',
        );
      });

      it('should block reading shell history files', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'cat ~/.bash_history',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe(
          'Reading history files may expose sensitive commands and credentials',
        );
      });

      it('should block reading GCP credentials', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          path: '/home/user/.config/gcloud/application_default_credentials.json',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('Reading GCP credentials may leak cloud service account keys');
      });
    });

    describe('with custom blacklist', () => {
      it('should work with multiple parameter matching', () => {
        const blacklist: SecurityBlacklistConfig = [
          {
            description: 'Dangerous operation on system files',
            match: {
              command: { pattern: 'rm.*', type: 'regex' },
              path: '/etc/*',
            },
          },
        ];

        // Both match - should block
        expect(
          InterventionChecker.checkSecurityBlacklist(blacklist, {
            command: 'rm -rf',
            path: '/etc/passwd',
          }).blocked,
        ).toBe(true);

        // Only command matches - should not block
        expect(
          InterventionChecker.checkSecurityBlacklist(blacklist, {
            command: 'rm -rf',
            path: '/tmp/file',
          }).blocked,
        ).toBe(false);

        // Only path matches - should not block
        expect(
          InterventionChecker.checkSecurityBlacklist(blacklist, {
            command: 'cat',
            path: '/etc/passwd',
          }).blocked,
        ).toBe(false);
      });
    });
  });

  describe('shouldIntervene with security blacklist', () => {
    describe('with default blacklist behavior', () => {
      it('should block dangerous commands even in auto-run mode', () => {
        // Even with config set to 'never', default blacklist should override
        const result = InterventionChecker.shouldIntervene({
          config: 'never',
          // Not passing securityBlacklist - should use DEFAULT_SECURITY_BLACKLIST
          toolArgs: { command: 'rm -rf ~/' },
        });

        expect(result).toBe('required');
      });

      it('should block dangerous commands even with no config', () => {
        // Even with no config (which normally means 'never'), default blacklist should override
        const result = InterventionChecker.shouldIntervene({
          config: undefined,
          // Not passing securityBlacklist - should use DEFAULT_SECURITY_BLACKLIST
          toolArgs: { command: 'rm -rf /' },
        });

        expect(result).toBe('required');
      });

      it('should allow safe commands to follow normal intervention rules', () => {
        // Safe command should follow normal config
        const result = InterventionChecker.shouldIntervene({
          config: 'never',
          // Not passing securityBlacklist - should use DEFAULT_SECURITY_BLACKLIST
          toolArgs: { command: 'ls -la' },
        });

        expect(result).toBe('never');
      });

      it('should block reading sensitive files', () => {
        // Test with actual default blacklist for sensitive file reading
        const result = InterventionChecker.shouldIntervene({
          config: 'never',
          // Not passing securityBlacklist - should use DEFAULT_SECURITY_BLACKLIST
          toolArgs: { command: 'cat .env' },
        });

        expect(result).toBe('required');
      });
    });

    describe('with custom blacklist replacement', () => {
      it('should use custom blacklist instead of default when provided', () => {
        const customBlacklist: SecurityBlacklistConfig = [
          {
            description: 'Block all npm commands in production',
            match: {
              command: { pattern: 'npm.*', type: 'regex' },
            },
          },
        ];

        // Custom blacklist blocks npm but not rm
        expect(
          InterventionChecker.shouldIntervene({
            config: 'never',
            securityBlacklist: customBlacklist,
            toolArgs: { command: 'npm install' },
          }),
        ).toBe('required');

        // rm is not in custom blacklist, should follow config
        expect(
          InterventionChecker.shouldIntervene({
            config: 'never',
            securityBlacklist: customBlacklist,
            toolArgs: { command: 'rm -rf ~/' },
          }),
        ).toBe('never');
      });

      it('should support extending default blacklist with custom rules', () => {
        const extendedBlacklist: SecurityBlacklistConfig = [
          ...DEFAULT_SECURITY_BLACKLIST,
          {
            description: 'Block access to production database',
            match: {
              command: { pattern: '.*psql.*production.*', type: 'regex' },
            },
          },
        ];

        // Default rule still works
        expect(
          InterventionChecker.shouldIntervene({
            config: 'never',
            securityBlacklist: extendedBlacklist,
            toolArgs: { command: 'rm -rf ~/' },
          }),
        ).toBe('required');

        // Custom rule works
        expect(
          InterventionChecker.shouldIntervene({
            config: 'never',
            securityBlacklist: extendedBlacklist,
            toolArgs: { command: 'psql -h production.db' },
          }),
        ).toBe('required');

        // Safe commands pass
        expect(
          InterventionChecker.shouldIntervene({
            config: 'never',
            securityBlacklist: extendedBlacklist,
            toolArgs: { command: 'psql -h localhost' },
          }),
        ).toBe('never');
      });

      it('should allow disabling security blacklist by passing empty array', () => {
        // Dangerous command should not be blocked when blacklist is empty
        const result = InterventionChecker.shouldIntervene({
          config: 'never',
          securityBlacklist: [], // Explicitly disable blacklist
          toolArgs: { command: 'rm -rf ~/' },
        });

        expect(result).toBe('never');
      });

      it('should support project-specific blacklist rules', () => {
        const projectBlacklist: SecurityBlacklistConfig = [
          {
            description: 'Block modifying package.json in CI',
            match: {
              path: { pattern: '.*/package\\.json$', type: 'regex' },
              command: { pattern: '(vim|nano|vi|emacs|code|sed).*', type: 'regex' },
            },
          },
        ];

        // Should block editing package.json
        expect(
          InterventionChecker.shouldIntervene({
            config: 'never',
            securityBlacklist: projectBlacklist,
            toolArgs: {
              command: 'vim package.json',
              path: '/project/package.json',
            },
          }),
        ).toBe('required');

        // Should allow reading package.json
        expect(
          InterventionChecker.shouldIntervene({
            config: 'never',
            securityBlacklist: projectBlacklist,
            toolArgs: {
              command: 'cat package.json',
              path: '/project/package.json',
            },
          }),
        ).toBe('never');
      });
    });
  });

  describe('Edge cases and additional scenarios', () => {
    describe('matchPattern edge cases', () => {
      it('should handle multiple wildcards in pattern', () => {
        expect(InterventionChecker['matchPattern']('*.test.*', 'file.test.ts')).toBe(true);
        expect(InterventionChecker['matchPattern']('*/*/*.ts', 'src/utils/helper.ts')).toBe(true);
        expect(InterventionChecker['matchPattern']('*Test*', 'myTestFile')).toBe(true);
      });

      it('should handle special regex characters in pattern', () => {
        expect(InterventionChecker['matchPattern']('file.ts', 'file.ts')).toBe(true);
        expect(InterventionChecker['matchPattern']('file.ts', 'filets')).toBe(false);
        expect(InterventionChecker['matchPattern']('file[1-3].ts', 'file[1-3].ts')).toBe(true);
        expect(InterventionChecker['matchPattern']('(test)', '(test)')).toBe(true);
      });

      it('should handle empty and single character patterns', () => {
        expect(InterventionChecker['matchPattern']('', '')).toBe(true);
        expect(InterventionChecker['matchPattern']('*', 'anything')).toBe(true);
        expect(InterventionChecker['matchPattern']('a', 'a')).toBe(true);
        expect(InterventionChecker['matchPattern']('a', 'b')).toBe(false);
      });

      it('should handle patterns with no wildcard', () => {
        expect(InterventionChecker['matchPattern']('exact-match', 'exact-match')).toBe(true);
        expect(InterventionChecker['matchPattern']('exact-match', 'exact-match-not')).toBe(false);
      });

      it('should handle complex colon patterns', () => {
        expect(InterventionChecker['matchPattern']('npm install:*', 'npm install:')).toBe(true);
        expect(InterventionChecker['matchPattern']('npm install:*', 'npm install:--save')).toBe(
          true,
        );
        expect(InterventionChecker['matchPattern']('docker run:*', 'docker run')).toBe(true);
        expect(InterventionChecker['matchPattern']('docker run:*', 'docker exec')).toBe(false);
      });
    });

    describe('matchesArgument edge cases', () => {
      it('should convert non-string values to strings', () => {
        expect(InterventionChecker['matchesArgument']('123', 123)).toBe(true);
        expect(InterventionChecker['matchesArgument']('true', true)).toBe(true);
        expect(InterventionChecker['matchesArgument']('null', null)).toBe(true);
      });

      it('should handle matcher with unknown type', () => {
        const matcher = { pattern: 'test', type: 'invalid' as any };
        expect(InterventionChecker['matchesArgument'](matcher, 'test')).toBe(false);
      });

      it('should handle regex patterns with special flags', () => {
        const matcher = { pattern: '^[A-Z]+$', type: 'regex' as const };
        expect(InterventionChecker['matchesArgument'](matcher, 'ABC')).toBe(true);
        expect(InterventionChecker['matchesArgument'](matcher, 'abc')).toBe(false);
        expect(InterventionChecker['matchesArgument'](matcher, '123')).toBe(false);
      });

      it('should handle complex wildcard patterns', () => {
        const matcher = { pattern: '/usr/*/bin/*', type: 'wildcard' as const };
        expect(InterventionChecker['matchesArgument'](matcher, '/usr/local/bin/node')).toBe(true);
        expect(InterventionChecker['matchesArgument'](matcher, '/usr/bin/node')).toBe(false);
      });
    });

    describe('checkSecurityBlacklist edge cases', () => {
      it('should handle blacklist with no match criteria', () => {
        const blacklist: SecurityBlacklistConfig = [
          {
            description: 'Invalid rule without match',
            match: undefined as any,
          },
        ];

        const result = InterventionChecker.checkSecurityBlacklist(blacklist, {
          command: 'anything',
        });
        expect(result.blocked).toBe(false);
      });

      it('should handle empty match object', () => {
        const blacklist: SecurityBlacklistConfig = [
          {
            description: 'Rule with empty match',
            match: {},
          },
        ];

        const result = InterventionChecker.checkSecurityBlacklist(blacklist, {
          command: 'anything',
        });
        expect(result.blocked).toBe(true);
      });

      it('should handle multiple rules with first match wins', () => {
        const blacklist: SecurityBlacklistConfig = [
          {
            description: 'First rule',
            match: { command: { pattern: 'rm.*', type: 'regex' } },
          },
          {
            description: 'Second rule',
            match: { command: { pattern: 'rm.*', type: 'regex' } },
          },
        ];

        const result = InterventionChecker.checkSecurityBlacklist(blacklist, {
          command: 'rm -rf',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('First rule');
      });

      it('should handle toolArgs with extra parameters not in match', () => {
        const blacklist: SecurityBlacklistConfig = [
          {
            description: 'Only checks command',
            match: { command: { pattern: 'rm.*', type: 'regex' } },
          },
        ];

        const result = InterventionChecker.checkSecurityBlacklist(blacklist, {
          command: 'rm -rf',
          path: '/tmp',
          extraParam: 'ignored',
        });
        expect(result.blocked).toBe(true);
      });
    });

    describe('shouldIntervene edge cases', () => {
      it('should handle empty array config', () => {
        const result = InterventionChecker.shouldIntervene({
          config: [],
          securityBlacklist: [],
          toolArgs: { command: 'anything' },
        });
        expect(result).toBe('required');
      });

      it('should handle config with only default rule', () => {
        const config: HumanInterventionConfig = [{ policy: 'never' }];

        const result = InterventionChecker.shouldIntervene({
          config,
          securityBlacklist: [],
          toolArgs: { command: 'anything' },
        });
        expect(result).toBe('never');
      });

      it('should prioritize security blacklist over any config', () => {
        const configs: HumanInterventionConfig[] = [
          'never',
          [{ policy: 'never' }],
          [{ match: { command: '*' }, policy: 'never' }],
        ];

        configs.forEach((config) => {
          const result = InterventionChecker.shouldIntervene({
            config,
            toolArgs: { command: 'rm -rf ~/' },
          });
          expect(result).toBe('required');
        });
      });

      it('should handle missing parameters in toolArgs', () => {
        const config: HumanInterventionConfig = [
          { match: { command: 'git add:*', path: '/project/*' }, policy: 'never' },
          { policy: 'required' },
        ];

        // Missing path parameter
        const result = InterventionChecker.shouldIntervene({
          config,
          securityBlacklist: [],
          toolArgs: { command: 'git add:.' },
        });
        expect(result).toBe('required');
      });
    });

    describe('hashArguments edge cases', () => {
      it('should handle special characters in values', () => {
        const args = {
          command: 'echo "hello world"',
          path: '/path/with/special-chars_123',
        };

        const hash = InterventionChecker.hashArguments(args);
        expect(hash).toBeDefined();
        expect(typeof hash).toBe('string');
        expect(hash.length).toBeGreaterThan(0);
      });

      it('should handle numeric values', () => {
        const args1 = { count: 42, enabled: true };
        const args2 = { count: 42, enabled: true };

        expect(InterventionChecker.hashArguments(args1)).toBe(
          InterventionChecker.hashArguments(args2),
        );
      });

      it('should handle arrays in arguments', () => {
        const args1 = { files: ['a.ts', 'b.ts'], count: 2 };
        const args2 = { files: ['a.ts', 'b.ts'], count: 2 };

        expect(InterventionChecker.hashArguments(args1)).toBe(
          InterventionChecker.hashArguments(args2),
        );
      });

      it('should produce different hashes for different array order', () => {
        const args1 = { files: ['a.ts', 'b.ts'] };
        const args2 = { files: ['b.ts', 'a.ts'] };

        expect(InterventionChecker.hashArguments(args1)).not.toBe(
          InterventionChecker.hashArguments(args2),
        );
      });

      it('should handle deeply nested structures', () => {
        const args = {
          config: {
            level1: {
              level2: {
                level3: {
                  value: 'deep',
                },
              },
            },
          },
        };

        const hash = InterventionChecker.hashArguments(args);
        expect(hash).toBeDefined();
        expect(typeof hash).toBe('string');
      });

      it('should handle null and undefined in nested objects', () => {
        const args = {
          value: null,
          nested: { inner: undefined },
        };

        const hash = InterventionChecker.hashArguments(args);
        expect(hash).toBeDefined();
      });
    });

    describe('generateToolKey edge cases', () => {
      it('should handle empty strings', () => {
        const key = InterventionChecker.generateToolKey('', '');
        expect(key).toBe('/');
      });

      it('should handle special characters in identifier and apiName', () => {
        const key = InterventionChecker.generateToolKey('my-tool_v2', 'api.endpoint');
        expect(key).toBe('my-tool_v2/api.endpoint');
      });

      it('should handle hash with special characters', () => {
        const key = InterventionChecker.generateToolKey('tool', 'api', 'abc123_xyz');
        expect(key).toBe('tool/api#abc123_xyz');
      });

      it('should handle empty hash string', () => {
        const key = InterventionChecker.generateToolKey('tool', 'api', '');
        expect(key).toBe('tool/api');
      });
    });

    describe('Additional DEFAULT_SECURITY_BLACKLIST tests', () => {
      it('should block system configuration modifications', () => {
        const dangerousCommands = [
          'echo "user ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers',
          'vim /etc/passwd',
          'nano /etc/shadow',
        ];

        dangerousCommands.forEach((cmd) => {
          const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
            command: cmd,
          });
          expect(result.blocked).toBe(true);
        });
      });

      it('should block firewall manipulation', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'ufw disable',
        });
        expect(result.blocked).toBe(true);
        expect(result.reason).toBe('Disabling firewall exposes system to attacks');
      });

      it('should block package manager removals of critical packages', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'apt remove systemd',
        });
        expect(result.blocked).toBe(true);
      });

      it('should block kernel parameter modifications', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'echo 1 >/proc/sys/kernel/randomize_va_space',
        });
        expect(result.blocked).toBe(true);
      });

      it('should block SUID permission changes on shells', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'chmod 4755 /bin/bash',
        });
        expect(result.blocked).toBe(true);
      });

      it('should block SSH config modifications', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'vim /etc/ssh/sshd_config',
        });
        expect(result.blocked).toBe(true);
      });

      it('should block filesystem formatting commands', () => {
        const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
          command: 'mkfs.ext4 /dev/sda1',
        });
        expect(result.blocked).toBe(true);
      });

      it('should allow safe operations on project files', () => {
        const safeCommands = [
          'cat package.json',
          'ls -la',
          'git status',
          'npm test',
          'rm -rf node_modules',
        ];

        safeCommands.forEach((cmd) => {
          const result = InterventionChecker.checkSecurityBlacklist(DEFAULT_SECURITY_BLACKLIST, {
            command: cmd,
          });
          expect(result.blocked).toBe(false);
        });
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle Bash tool scenario', () => {
      const config: HumanInterventionConfig = [
        { match: { command: 'ls:*' }, policy: 'never' },
        { match: { command: 'git add:*' }, policy: 'required' },
        { match: { command: 'git commit:*' }, policy: 'required' },
        { match: { command: 'rm:*' }, policy: 'required' },
        { policy: 'required' },
      ];

      // Safe commands - never
      expect(
        InterventionChecker.shouldIntervene({
          config,
          securityBlacklist: [], // Disable blacklist for this test
          toolArgs: { command: 'ls:' },
        }),
      ).toBe('never');

      // Git commands - require
      expect(
        InterventionChecker.shouldIntervene({
          config,
          securityBlacklist: [], // Disable blacklist for this test
          toolArgs: { command: 'git add:.' },
        }),
      ).toBe('required');
      expect(
        InterventionChecker.shouldIntervene({
          config,
          securityBlacklist: [], // Disable blacklist for this test
          toolArgs: { command: 'git commit:-m' },
        }),
      ).toBe('required');

      // Dangerous commands - require
      expect(
        InterventionChecker.shouldIntervene({
          config,
          securityBlacklist: [], // Disable blacklist for this test
          toolArgs: { command: 'rm:-rf' },
        }),
      ).toBe('required');
      expect(
        InterventionChecker.shouldIntervene({
          config,
          securityBlacklist: [], // Disable blacklist for this test
          toolArgs: { command: 'npm install' },
        }),
      ).toBe('required');
    });

    it('should handle LocalSystem tool scenario', () => {
      const config: HumanInterventionConfig = [
        { match: { path: '/Users/project/*' }, policy: 'never' },
        { policy: 'required' },
      ];

      // Project directory - never
      expect(
        InterventionChecker.shouldIntervene({
          config,
          securityBlacklist: [], // Disable blacklist for this test
          toolArgs: { path: '/Users/project/file.ts' },
        }),
      ).toBe('never');

      // Outside project - require
      expect(
        InterventionChecker.shouldIntervene({
          config,
          securityBlacklist: [], // Disable blacklist for this test
          toolArgs: { path: '/tmp/file.ts' },
        }),
      ).toBe('required');
    });

    it('should handle Web Browsing tool with simple policy', () => {
      const config: HumanInterventionConfig = 'required';

      expect(
        InterventionChecker.shouldIntervene({
          config,
          securityBlacklist: [], // Disable blacklist for this test
          toolArgs: { url: 'https://example.com' },
        }),
      ).toBe('required');
    });

    it('should handle security blacklist overriding user config', () => {
      const config: HumanInterventionConfig = 'never';
      const blacklist: SecurityBlacklistConfig = DEFAULT_SECURITY_BLACKLIST;

      // Dangerous command blocked even with 'never' config
      expect(
        InterventionChecker.shouldIntervene({
          config,
          securityBlacklist: blacklist,
          toolArgs: { command: 'rm -rf /' },
        }),
      ).toBe('required');

      // Safe command follows config
      expect(
        InterventionChecker.shouldIntervene({
          config,
          securityBlacklist: blacklist,
          toolArgs: { command: 'ls -la' },
        }),
      ).toBe('never');
    });
  });
});
