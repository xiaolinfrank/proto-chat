import { LobeChatDatabase } from '@lobechat/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserModel } from '@/database/models/user';
import { pino } from '@/libs/logger';
import { AgentService } from '@/server/services/agent';

import { NextAuthUserService } from './index';

// Mock dependencies
vi.mock('@/database/models/user', () => {
  const MockUserModel = vi.fn();
  // @ts-ignore
  MockUserModel.findByEmail = vi.fn();
  // @ts-ignore
  MockUserModel.findById = vi.fn();
  // @ts-ignore
  MockUserModel.createUser = vi.fn();
  // @ts-ignore
  MockUserModel.deleteUser = vi.fn();
  MockUserModel.prototype.updateUser = vi.fn();
  return { UserModel: MockUserModel };
});

vi.mock('@/libs/logger', () => ({
  pino: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/server/services/agent', () => ({
  AgentService: vi.fn().mockImplementation(() => ({
    createInbox: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ body, init })),
  },
}));

vi.mock('@/utils/merge', () => ({
  merge: vi.fn((a, b) => ({ ...a, ...b })),
}));

// Helper to create a chainable DB query mock
const makeQueryChain = (resolveValue: any) => {
  const chain: any = {
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    then: (fn: any, rej?: any) => Promise.resolve(resolveValue).then(fn, rej),
  };
  return chain;
};

const createMockDb = () => ({
  insert: vi.fn(),
  select: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
});

let service: NextAuthUserService;
let mockDb: ReturnType<typeof createMockDb>;

const mockLobeUser = {
  id: 'user-123',
  fullName: 'Test User',
  email: 'test@example.com',
  avatar: 'https://example.com/avatar.png',
  emailVerifiedAt: null,
};

const mockAdapterUser = {
  id: 'user-123',
  name: 'Test User',
  email: 'test@example.com',
  image: 'https://example.com/avatar.png',
  emailVerified: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb = createMockDb();
  service = new NextAuthUserService(mockDb as unknown as LobeChatDatabase);
});

describe('NextAuthUserService', () => {
  describe('createUser', () => {
    it('should return existing user when found by email', async () => {
      vi.mocked(UserModel.findByEmail).mockResolvedValue(mockLobeUser as any);

      const result = await service.createUser({
        id: 'new-id',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        emailVerified: null,
      });

      expect(UserModel.findByEmail).toHaveBeenCalled();
      expect(UserModel.createUser).not.toHaveBeenCalled();
      expect(result.id).toBe(mockLobeUser.id);
    });

    it('should return existing user when found by providerAccountId', async () => {
      vi.mocked(UserModel.findByEmail).mockResolvedValue(null as any);
      vi.mocked(UserModel.findById).mockResolvedValue(mockLobeUser as any);

      const result = await service.createUser({
        id: 'new-id',
        email: '',
        name: 'Test User',
        image: null,
        emailVerified: null,
        providerAccountId: 'provider-account-1',
      } as any);

      expect(UserModel.findById).toHaveBeenCalledWith(mockDb, 'provider-account-1');
      expect(UserModel.createUser).not.toHaveBeenCalled();
      expect(result.id).toBe(mockLobeUser.id);
    });

    it('should create a new user when not found', async () => {
      vi.mocked(UserModel.findByEmail).mockResolvedValue(null as any);
      vi.mocked(UserModel.findById).mockResolvedValue(null as any);
      vi.mocked(UserModel.createUser).mockResolvedValue(undefined as any);

      const newUser = {
        id: 'new-id',
        email: 'new@example.com',
        name: 'New User',
        image: null,
        emailVerified: null,
      };

      const result = await service.createUser(newUser);

      expect(UserModel.createUser).toHaveBeenCalled();
      expect(AgentService).toHaveBeenCalledWith(mockDb, 'new-id');
      expect(result.id).toBe('new-id');
    });

    it('should use providerAccountId as uid when creating new user', async () => {
      vi.mocked(UserModel.findByEmail).mockResolvedValue(null as any);
      vi.mocked(UserModel.findById).mockResolvedValue(null as any);
      vi.mocked(UserModel.createUser).mockResolvedValue(undefined as any);

      const result = await service.createUser({
        id: 'fallback-id',
        email: 'provider@example.com',
        name: 'Provider User',
        image: null,
        emailVerified: null,
        providerAccountId: 'provider-123',
      } as any);

      expect(AgentService).toHaveBeenCalledWith(mockDb, 'provider-123');
      expect(result.id).toBe('provider-123');
    });

    it('should skip email lookup when email is empty', async () => {
      vi.mocked(UserModel.findByEmail).mockResolvedValue(null as any);
      vi.mocked(UserModel.findById).mockResolvedValue(null as any);
      vi.mocked(UserModel.createUser).mockResolvedValue(undefined as any);

      await service.createUser({
        id: 'no-email-id',
        email: '   ',
        name: 'No Email User',
        image: null,
        emailVerified: null,
      });

      expect(UserModel.findByEmail).not.toHaveBeenCalled();
    });
  });

  describe('getUserByEmail', () => {
    it('should return adapter user when lobe user is found', async () => {
      vi.mocked(UserModel.findByEmail).mockResolvedValue(mockLobeUser as any);

      const result = await service.getUserByEmail('test@example.com');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('user-123');
      expect(result?.email).toBe('test@example.com');
    });

    it('should return null when user is not found', async () => {
      vi.mocked(UserModel.findByEmail).mockResolvedValue(null as any);

      const result = await service.getUserByEmail('notfound@example.com');

      expect(result).toBeNull();
    });

    it('should return null without querying DB when email is empty string', async () => {
      const result = await service.getUserByEmail('');

      expect(UserModel.findByEmail).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null without querying DB when email is whitespace', async () => {
      const result = await service.getUserByEmail('   ');

      expect(UserModel.findByEmail).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('getUser', () => {
    it('should return adapter user when found', async () => {
      vi.mocked(UserModel.findById).mockResolvedValue(mockLobeUser as any);

      const result = await service.getUser('user-123');

      expect(UserModel.findById).toHaveBeenCalledWith(mockDb, 'user-123');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('user-123');
    });

    it('should return null when user is not found', async () => {
      vi.mocked(UserModel.findById).mockResolvedValue(null as any);

      const result = await service.getUser('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('deleteUser', () => {
    it('should delete user when found', async () => {
      vi.mocked(UserModel.findById).mockResolvedValue(mockLobeUser as any);
      vi.mocked(UserModel.deleteUser).mockResolvedValue(undefined as any);

      await service.deleteUser('user-123');

      expect(UserModel.findById).toHaveBeenCalledWith(mockDb, 'user-123');
      expect(UserModel.deleteUser).toHaveBeenCalledWith(mockDb, 'user-123');
    });

    it('should throw error when user not found', async () => {
      vi.mocked(UserModel.findById).mockResolvedValue(null as any);

      await expect(service.deleteUser('missing-user')).rejects.toThrow(
        'NextAuth: Delete User not found',
      );
      expect(UserModel.deleteUser).not.toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    it('should throw error when user not found', async () => {
      vi.mocked(UserModel.findById).mockResolvedValue(null as any);

      await expect(service.updateUser({ id: 'missing', email: 'test@test.com' })).rejects.toThrow(
        'NextAuth: User not found',
      );
    });

    it('should throw error when updateUser returns null', async () => {
      vi.mocked(UserModel.findById).mockResolvedValue(mockLobeUser as any);
      vi.mocked(UserModel.prototype.updateUser).mockResolvedValue(null as any);

      await expect(
        service.updateUser({ id: 'user-123', email: 'test@example.com' }),
      ).rejects.toThrow('NextAuth: Failed to update user');
    });

    it('should return merged adapter user on success', async () => {
      vi.mocked(UserModel.findById).mockResolvedValue(mockLobeUser as any);
      vi.mocked(UserModel.prototype.updateUser).mockResolvedValue(mockLobeUser as any);

      const updatedUser = { id: 'user-123', email: 'updated@example.com' };
      const result = await service.updateUser(updatedUser);

      expect(result).toBeDefined();
      expect(result.id).toBe('user-123');
    });
  });

  describe('createSession', () => {
    it('should insert session and return it', async () => {
      const mockSession = {
        sessionToken: 'token-1',
        userId: 'user-123',
        expires: new Date(),
      };
      mockDb.insert.mockReturnValue(makeQueryChain([mockSession]));

      const result = await service.createSession(mockSession);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual(mockSession);
    });
  });

  describe('deleteSession', () => {
    it('should delete session by token', async () => {
      const chain = makeQueryChain(undefined);
      mockDb.delete.mockReturnValue(chain);

      await service.deleteSession('session-token-123');

      expect(mockDb.delete).toHaveBeenCalled();
      expect(chain.where).toHaveBeenCalled();
    });
  });

  describe('updateSession', () => {
    it('should update session and return result', async () => {
      const updatedSession = {
        sessionToken: 'token-1',
        userId: 'user-123',
        expires: new Date(),
      };
      mockDb.update.mockReturnValue(makeQueryChain([updatedSession]));

      const result = await service.updateSession(updatedSession);

      expect(mockDb.update).toHaveBeenCalled();
      expect(result).toEqual(updatedSession);
    });
  });

  describe('createVerificationToken', () => {
    it('should insert token and return it', async () => {
      const mockToken = {
        identifier: 'test@example.com',
        token: 'verify-123',
        expires: new Date(),
      };
      mockDb.insert.mockReturnValue(makeQueryChain([mockToken]));

      const result = await service.createVerificationToken(mockToken);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual(mockToken);
    });
  });

  describe('linkAccount', () => {
    it('should insert account and return it', async () => {
      const mockAccount = {
        provider: 'github',
        providerAccountId: 'gh-123',
        userId: 'user-123',
        type: 'oauth' as const,
      };
      mockDb.insert.mockReturnValue(makeQueryChain([mockAccount]));

      const result = await service.linkAccount(mockAccount);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw error when insert returns empty', async () => {
      mockDb.insert.mockReturnValue(makeQueryChain([]));

      await expect(
        service.linkAccount({
          provider: 'github',
          providerAccountId: 'gh-123',
          userId: 'user-123',
          type: 'oauth' as const,
        }),
      ).rejects.toThrow('NextAuthAccountModel: Failed to create account');
    });
  });

  describe('safeUpdateUser', () => {
    it('should update user when found by account', async () => {
      // Mock getUserByAccount to return a user
      const mockAccountQueryChain = makeQueryChain([{ users: mockLobeUser, account: {} }]);
      mockDb.select.mockReturnValue(mockAccountQueryChain);
      vi.mocked(UserModel.prototype.updateUser).mockResolvedValue(mockLobeUser as any);

      const result = await service.safeUpdateUser(
        { provider: 'github', providerAccountId: 'gh-123' },
        { avatar: 'new-avatar', email: 'new@example.com', fullName: 'New Name' },
      );

      expect(pino.info).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should log warning when user not found by account', async () => {
      const mockEmptyChain = makeQueryChain([]);
      mockDb.select.mockReturnValue(mockEmptyChain);

      await service.safeUpdateUser(
        { provider: 'github', providerAccountId: 'gh-unknown' },
        { avatar: 'avatar' },
      );

      expect(pino.warn).toHaveBeenCalled();
    });
  });

  describe('safeSignOutUser', () => {
    it('should delete sessions when user is found by account', async () => {
      const mockAccountQueryChain = makeQueryChain([{ users: mockLobeUser, account: {} }]);
      mockDb.select.mockReturnValue(mockAccountQueryChain);

      const deleteChain = makeQueryChain(undefined);
      mockDb.delete.mockReturnValue(deleteChain);

      const result = await service.safeSignOutUser({
        provider: 'github',
        providerAccountId: 'gh-123',
      });

      expect(mockDb.delete).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should log warning when user not found and skip delete', async () => {
      mockDb.select.mockReturnValue(makeQueryChain([]));

      await service.safeSignOutUser({
        provider: 'github',
        providerAccountId: 'gh-unknown',
      });

      expect(pino.warn).toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  describe('getAuthenticator', () => {
    it('should return mapped authenticator when found', async () => {
      const mockAuthRow = {
        counter: 1,
        credentialBackedUp: false,
        credentialDeviceType: 'single',
        credentialID: 'cred-1',
        credentialPublicKey: 'pubkey',
        providerAccountId: 'provider-1',
        transports: null,
        userId: 'user-123',
      };
      mockDb.select.mockReturnValue(makeQueryChain([mockAuthRow]));

      const result = await service.getAuthenticator('cred-1');

      expect(result).not.toBeNull();
      expect(result!.credentialID).toBe('cred-1');
      expect(result!.transports).toBeUndefined();
    });

    it('should throw error when authenticator not found', async () => {
      mockDb.select.mockReturnValue(makeQueryChain([]));

      await expect(service.getAuthenticator('not-found')).rejects.toThrow(
        'NextAuthUserService: Failed to get authenticator',
      );
    });
  });

  describe('listAuthenticatorsByUserId', () => {
    it('should return mapped authenticator list', async () => {
      const mockAuthRows = [
        {
          counter: 1,
          credentialBackedUp: false,
          credentialDeviceType: 'single',
          credentialID: 'cred-1',
          credentialPublicKey: 'pubkey-1',
          providerAccountId: 'provider-1',
          transports: 'usb',
          userId: 'user-123',
        },
        {
          counter: 2,
          credentialBackedUp: true,
          credentialDeviceType: 'multi',
          credentialID: 'cred-2',
          credentialPublicKey: 'pubkey-2',
          providerAccountId: 'provider-2',
          transports: null,
          userId: 'user-123',
        },
      ];
      mockDb.select.mockReturnValue(makeQueryChain(mockAuthRows));

      const result = await service.listAuthenticatorsByUserId('user-123');

      expect(result).toHaveLength(2);
      expect(result[0].credentialID).toBe('cred-1');
      expect(result[1].transports).toBeUndefined();
    });

    it('should throw error when no authenticators found', async () => {
      mockDb.select.mockReturnValue(makeQueryChain([]));

      await expect(service.listAuthenticatorsByUserId('user-with-no-auth')).rejects.toThrow(
        'NextAuthUserService: Failed to get authenticator list',
      );
    });
  });

  describe('updateAuthenticatorCounter', () => {
    it('should update and return mapped authenticator', async () => {
      const mockAuthRow = {
        counter: 5,
        credentialBackedUp: false,
        credentialDeviceType: 'single',
        credentialID: 'cred-1',
        credentialPublicKey: 'pubkey',
        providerAccountId: 'provider-1',
        transports: null,
        userId: 'user-123',
      };
      mockDb.update.mockReturnValue(makeQueryChain([mockAuthRow]));

      const result = await service.updateAuthenticatorCounter('cred-1', 5);

      expect(mockDb.update).toHaveBeenCalled();
      expect(result.counter).toBe(5);
    });

    it('should throw error when update returns nothing', async () => {
      mockDb.update.mockReturnValue(makeQueryChain([]));

      await expect(service.updateAuthenticatorCounter('cred-missing', 1)).rejects.toThrow(
        'NextAuthUserService: Failed to update authenticator counter',
      );
    });
  });
});
