import { describe, expect, it } from 'vitest';

import {
  mapAdapterUserToLobeUser,
  mapAuthenticatorQueryResutlToAdapterAuthenticator,
  mapLobeUserToAdapterUser,
  partialMapAdapterUserToLobeUser,
} from './utils';

describe('nextAuthUser utils', () => {
  describe('mapAdapterUserToLobeUser', () => {
    it('should map all fields correctly', () => {
      const emailVerified = new Date('2024-01-01T00:00:00Z');
      const adapterUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: 'https://example.com/avatar.jpg',
        emailVerified,
      };

      const result = mapAdapterUserToLobeUser(adapterUser);

      expect(result).toEqual({
        avatar: 'https://example.com/avatar.jpg',
        email: 'test@example.com',
        emailVerifiedAt: emailVerified,
        fullName: 'Test User',
        id: 'user-123',
      });
    });

    it('should set emailVerifiedAt to undefined when emailVerified is null', () => {
      const adapterUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        emailVerified: null,
      };

      const result = mapAdapterUserToLobeUser(adapterUser);

      expect(result.emailVerifiedAt).toBeUndefined();
    });

    it('should handle null image and name', () => {
      const adapterUser = {
        id: 'user-123',
        email: null,
        name: null,
        image: null,
        emailVerified: null,
      } as any;

      const result = mapAdapterUserToLobeUser(adapterUser);

      expect(result).toEqual({
        avatar: null,
        email: null,
        emailVerifiedAt: undefined,
        fullName: null,
        id: 'user-123',
      });
    });

    it('should convert emailVerified date correctly', () => {
      const emailVerified = new Date('2023-06-15T10:30:00Z');
      const adapterUser = {
        id: 'abc',
        email: 'a@b.com',
        name: 'A',
        image: null,
        emailVerified,
      };

      const result = mapAdapterUserToLobeUser(adapterUser);

      expect(result.emailVerifiedAt).toEqual(new Date(emailVerified));
    });
  });

  describe('partialMapAdapterUserToLobeUser', () => {
    it('should map all provided fields', () => {
      const emailVerified = new Date('2024-02-01T00:00:00Z');
      const partial = {
        id: 'user-456',
        email: 'partial@example.com',
        name: 'Partial User',
        image: 'https://example.com/img.png',
        emailVerified,
      };

      const result = partialMapAdapterUserToLobeUser(partial);

      expect(result).toEqual({
        avatar: 'https://example.com/img.png',
        email: 'partial@example.com',
        emailVerifiedAt: emailVerified,
        fullName: 'Partial User',
        id: 'user-456',
      });
    });

    it('should handle empty partial object', () => {
      const result = partialMapAdapterUserToLobeUser({});

      expect(result).toEqual({
        avatar: undefined,
        email: undefined,
        emailVerifiedAt: undefined,
        fullName: undefined,
        id: undefined,
      });
    });

    it('should set emailVerifiedAt to undefined when emailVerified is not provided', () => {
      const result = partialMapAdapterUserToLobeUser({ id: 'x', email: 'x@x.com' });

      expect(result.emailVerifiedAt).toBeUndefined();
    });

    it('should set emailVerifiedAt when emailVerified is provided', () => {
      const emailVerified = new Date('2025-01-01');
      const result = partialMapAdapterUserToLobeUser({ emailVerified });

      expect(result.emailVerifiedAt).toEqual(new Date(emailVerified));
    });
  });

  describe('mapLobeUserToAdapterUser', () => {
    it('should map all fields correctly', () => {
      const emailVerifiedAt = new Date('2024-03-01T00:00:00Z');
      const lobeUser = {
        id: 'lobe-user-1',
        fullName: 'Lobe User',
        email: 'lobe@example.com',
        avatar: 'https://example.com/lobe.png',
        emailVerifiedAt,
      };

      const result = mapLobeUserToAdapterUser(lobeUser as any);

      expect(result).toEqual({
        email: 'lobe@example.com',
        emailVerified: emailVerifiedAt,
        id: 'lobe-user-1',
        image: 'https://example.com/lobe.png',
        name: 'Lobe User',
      });
    });

    it('should use empty string when email is null', () => {
      const lobeUser = {
        id: 'lobe-2',
        fullName: 'No Email',
        email: null,
        avatar: null,
        emailVerifiedAt: null,
      };

      const result = mapLobeUserToAdapterUser(lobeUser as any);

      expect(result.email).toBe('');
    });

    it('should set emailVerified to null when emailVerifiedAt is null', () => {
      const lobeUser = {
        id: 'lobe-3',
        fullName: null,
        email: 'test@test.com',
        avatar: null,
        emailVerifiedAt: null,
      };

      const result = mapLobeUserToAdapterUser(lobeUser as any);

      expect(result.emailVerified).toBeNull();
    });

    it('should convert emailVerifiedAt date correctly', () => {
      const emailVerifiedAt = new Date('2023-12-31T23:59:59Z');
      const lobeUser = {
        id: 'lobe-4',
        fullName: 'User',
        email: 'user@test.com',
        avatar: null,
        emailVerifiedAt,
      };

      const result = mapLobeUserToAdapterUser(lobeUser as any);

      expect(result.emailVerified).toEqual(new Date(emailVerifiedAt));
    });
  });

  describe('mapAuthenticatorQueryResutlToAdapterAuthenticator', () => {
    it('should map all fields including non-null transports', () => {
      const authenticator = {
        counter: 5,
        credentialBackedUp: true,
        credentialDeviceType: 'multiDevice',
        credentialID: 'cred-abc',
        credentialPublicKey: 'pubkey-xyz',
        providerAccountId: 'provider-1',
        transports: 'usb,nfc',
        userId: 'user-1',
      };

      const result = mapAuthenticatorQueryResutlToAdapterAuthenticator(authenticator);

      expect(result).toEqual({
        counter: 5,
        credentialBackedUp: true,
        credentialDeviceType: 'multiDevice',
        credentialID: 'cred-abc',
        credentialPublicKey: 'pubkey-xyz',
        providerAccountId: 'provider-1',
        transports: 'usb,nfc',
        userId: 'user-1',
      });
    });

    it('should replace null transports with undefined', () => {
      const authenticator = {
        counter: 0,
        credentialBackedUp: false,
        credentialDeviceType: 'singleDevice',
        credentialID: 'cred-def',
        credentialPublicKey: 'pubkey-abc',
        providerAccountId: 'provider-2',
        transports: null,
        userId: 'user-2',
      };

      const result = mapAuthenticatorQueryResutlToAdapterAuthenticator(authenticator);

      expect(result.transports).toBeUndefined();
    });

    it('should preserve all other fields when transports is null', () => {
      const authenticator = {
        counter: 10,
        credentialBackedUp: true,
        credentialDeviceType: 'multiDevice',
        credentialID: 'cred-ghi',
        credentialPublicKey: 'pubkey-def',
        providerAccountId: 'provider-3',
        transports: null,
        userId: 'user-3',
      };

      const result = mapAuthenticatorQueryResutlToAdapterAuthenticator(authenticator);

      expect(result.counter).toBe(10);
      expect(result.credentialBackedUp).toBe(true);
      expect(result.credentialID).toBe('cred-ghi');
      expect(result.userId).toBe('user-3');
    });
  });
});
