import { describe, expect, it } from 'vitest';

import {
  mapAdapterUserToLobeUser,
  mapAuthenticatorQueryResutlToAdapterAuthenticator,
  mapLobeUserToAdapterUser,
  partialMapAdapterUserToLobeUser,
} from './utils';

describe('nextAuthUser utils', () => {
  describe('mapAdapterUserToLobeUser', () => {
    it('should map a full AdapterUser to LobeUser correctly', () => {
      const emailVerifiedDate = new Date('2024-01-01');
      const adapterUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: 'https://example.com/avatar.png',
        emailVerified: emailVerifiedDate,
      };

      const result = mapAdapterUserToLobeUser(adapterUser);

      expect(result).toEqual({
        avatar: 'https://example.com/avatar.png',
        email: 'test@example.com',
        emailVerifiedAt: emailVerifiedDate,
        fullName: 'Test User',
        id: 'user-123',
      });
    });

    it('should map AdapterUser with null emailVerified to undefined emailVerifiedAt', () => {
      const adapterUser = {
        id: 'user-456',
        email: 'no-verified@example.com',
        name: 'Unverified User',
        image: null,
        emailVerified: null,
      };

      const result = mapAdapterUserToLobeUser(adapterUser);

      expect(result.emailVerifiedAt).toBeUndefined();
      expect(result.avatar).toBeNull();
    });

    it('should handle null name and image', () => {
      const adapterUser = {
        id: 'user-789',
        email: 'minimal@example.com',
        name: null,
        image: null,
        emailVerified: null,
      };

      const result = mapAdapterUserToLobeUser(adapterUser);

      expect(result.fullName).toBeNull();
      expect(result.avatar).toBeNull();
      expect(result.id).toBe('user-789');
      expect(result.email).toBe('minimal@example.com');
    });

    it('should convert emailVerified date correctly', () => {
      const specificDate = new Date('2023-06-15T10:30:00.000Z');
      const adapterUser = {
        id: 'user-date-test',
        email: 'dated@example.com',
        name: 'Dated User',
        image: null,
        emailVerified: specificDate,
      };

      const result = mapAdapterUserToLobeUser(adapterUser);

      expect(result.emailVerifiedAt).toEqual(new Date(specificDate));
    });
  });

  describe('partialMapAdapterUserToLobeUser', () => {
    it('should map partial AdapterUser with all fields', () => {
      const emailVerifiedDate = new Date('2024-01-01');
      const partialUser = {
        id: 'user-partial',
        email: 'partial@example.com',
        name: 'Partial User',
        image: 'https://example.com/img.png',
        emailVerified: emailVerifiedDate,
      };

      const result = partialMapAdapterUserToLobeUser(partialUser);

      expect(result).toEqual({
        avatar: 'https://example.com/img.png',
        email: 'partial@example.com',
        emailVerifiedAt: emailVerifiedDate,
        fullName: 'Partial User',
        id: 'user-partial',
      });
    });

    it('should handle an empty partial AdapterUser', () => {
      const result = partialMapAdapterUserToLobeUser({});

      expect(result).toEqual({
        avatar: undefined,
        email: undefined,
        emailVerifiedAt: undefined,
        fullName: undefined,
        id: undefined,
      });
    });

    it('should handle partial user with only id', () => {
      const result = partialMapAdapterUserToLobeUser({ id: 'user-only-id' });

      expect(result.id).toBe('user-only-id');
      expect(result.email).toBeUndefined();
      expect(result.avatar).toBeUndefined();
      expect(result.fullName).toBeUndefined();
      expect(result.emailVerifiedAt).toBeUndefined();
    });

    it('should map null emailVerified to undefined emailVerifiedAt', () => {
      const result = partialMapAdapterUserToLobeUser({
        emailVerified: null,
        id: 'user-null-verified',
      });

      expect(result.emailVerifiedAt).toBeUndefined();
    });

    it('should correctly set emailVerifiedAt from a date', () => {
      const date = new Date('2025-01-01');
      const result = partialMapAdapterUserToLobeUser({
        emailVerified: date,
        id: 'user-with-date',
      });

      expect(result.emailVerifiedAt).toEqual(new Date(date));
    });
  });

  describe('mapLobeUserToAdapterUser', () => {
    it('should map a full LobeUser to AdapterUser correctly', () => {
      const emailVerifiedAt = new Date('2024-06-01');
      const lobeUser = {
        id: 'lobe-user-1',
        fullName: 'Lobe User',
        email: 'lobe@example.com',
        avatar: 'https://example.com/lobe-avatar.png',
        emailVerifiedAt,
      };

      const result = mapLobeUserToAdapterUser(lobeUser as any);

      expect(result).toEqual({
        email: 'lobe@example.com',
        emailVerified: new Date(emailVerifiedAt),
        id: 'lobe-user-1',
        image: 'https://example.com/lobe-avatar.png',
        name: 'Lobe User',
      });
    });

    it('should use empty string for null email', () => {
      const lobeUser = {
        id: 'user-null-email',
        fullName: 'No Email User',
        email: null,
        avatar: null,
        emailVerifiedAt: null,
      };

      const result = mapLobeUserToAdapterUser(lobeUser as any);

      expect(result.email).toBe('');
    });

    it('should set emailVerified to null when emailVerifiedAt is falsy', () => {
      const lobeUser = {
        id: 'user-no-verify',
        fullName: 'Test',
        email: 'test@example.com',
        avatar: null,
        emailVerifiedAt: null,
      };

      const result = mapLobeUserToAdapterUser(lobeUser as any);

      expect(result.emailVerified).toBeNull();
    });

    it('should set emailVerified to null when emailVerifiedAt is undefined', () => {
      const lobeUser = {
        id: 'user-no-verify',
        fullName: 'Test',
        email: 'test@example.com',
        avatar: null,
        emailVerifiedAt: undefined,
      };

      const result = mapLobeUserToAdapterUser(lobeUser as any);

      expect(result.emailVerified).toBeNull();
    });

    it('should map avatar to image', () => {
      const lobeUser = {
        id: 'user-avatar',
        fullName: 'Avatar User',
        email: 'avatar@example.com',
        avatar: 'https://example.com/picture.jpg',
        emailVerifiedAt: null,
      };

      const result = mapLobeUserToAdapterUser(lobeUser as any);

      expect(result.image).toBe('https://example.com/picture.jpg');
    });

    it('should map fullName to name', () => {
      const lobeUser = {
        id: 'user-name',
        fullName: 'John Doe',
        email: 'john@example.com',
        avatar: null,
        emailVerifiedAt: null,
      };

      const result = mapLobeUserToAdapterUser(lobeUser as any);

      expect(result.name).toBe('John Doe');
    });
  });

  describe('mapAuthenticatorQueryResutlToAdapterAuthenticator', () => {
    it('should map all fields from query result to authenticator', () => {
      const queryResult = {
        counter: 42,
        credentialBackedUp: true,
        credentialDeviceType: 'multiDevice',
        credentialID: 'cred-id-123',
        credentialPublicKey: 'public-key-abc',
        providerAccountId: 'provider-account-456',
        transports: 'usb,nfc',
        userId: 'user-789',
      };

      const result = mapAuthenticatorQueryResutlToAdapterAuthenticator(queryResult);

      expect(result).toEqual({
        counter: 42,
        credentialBackedUp: true,
        credentialDeviceType: 'multiDevice',
        credentialID: 'cred-id-123',
        credentialPublicKey: 'public-key-abc',
        providerAccountId: 'provider-account-456',
        transports: 'usb,nfc',
        userId: 'user-789',
      });
    });

    it('should convert null transports to undefined', () => {
      const queryResult = {
        counter: 0,
        credentialBackedUp: false,
        credentialDeviceType: 'singleDevice',
        credentialID: 'cred-id-456',
        credentialPublicKey: 'public-key-xyz',
        providerAccountId: 'provider-account-789',
        transports: null,
        userId: 'user-null-transports',
      };

      const result = mapAuthenticatorQueryResutlToAdapterAuthenticator(queryResult);

      expect(result.transports).toBeUndefined();
    });

    it('should preserve non-null transports as-is', () => {
      const queryResult = {
        counter: 1,
        credentialBackedUp: true,
        credentialDeviceType: 'multiDevice',
        credentialID: 'cred-id',
        credentialPublicKey: 'pub-key',
        providerAccountId: 'account-id',
        transports: 'internal',
        userId: 'user-id',
      };

      const result = mapAuthenticatorQueryResutlToAdapterAuthenticator(queryResult);

      expect(result.transports).toBe('internal');
    });

    it('should preserve zero counter value', () => {
      const queryResult = {
        counter: 0,
        credentialBackedUp: false,
        credentialDeviceType: 'singleDevice',
        credentialID: 'cred-zero',
        credentialPublicKey: 'pub-zero',
        providerAccountId: 'acc-zero',
        transports: null,
        userId: 'user-zero',
      };

      const result = mapAuthenticatorQueryResutlToAdapterAuthenticator(queryResult);

      expect(result.counter).toBe(0);
    });

    it('should preserve credentialBackedUp false value', () => {
      const queryResult = {
        counter: 5,
        credentialBackedUp: false,
        credentialDeviceType: 'singleDevice',
        credentialID: 'cred-backed',
        credentialPublicKey: 'pub-backed',
        providerAccountId: 'acc-backed',
        transports: null,
        userId: 'user-backed',
      };

      const result = mapAuthenticatorQueryResutlToAdapterAuthenticator(queryResult);

      expect(result.credentialBackedUp).toBe(false);
    });
  });
});
