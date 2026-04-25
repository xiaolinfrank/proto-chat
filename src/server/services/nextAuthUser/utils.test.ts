// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  mapAdapterUserToLobeUser,
  mapAuthenticatorQueryResutlToAdapterAuthenticator,
  mapLobeUserToAdapterUser,
  partialMapAdapterUserToLobeUser,
} from './utils';

describe('nextAuthUser utils', () => {
  describe('mapAdapterUserToLobeUser', () => {
    it('should map all fields from adapter user to lobe user', () => {
      const emailVerifiedDate = new Date('2024-01-15');
      const adapterUser = {
        email: 'user@example.com',
        emailVerified: emailVerifiedDate,
        id: 'user-id-123',
        image: 'https://example.com/avatar.png',
        name: 'John Doe',
      };

      const result = mapAdapterUserToLobeUser(adapterUser);

      expect(result).toEqual({
        avatar: 'https://example.com/avatar.png',
        email: 'user@example.com',
        emailVerifiedAt: emailVerifiedDate,
        fullName: 'John Doe',
        id: 'user-id-123',
      });
    });

    it('should set emailVerifiedAt to undefined when emailVerified is null', () => {
      const adapterUser = {
        email: 'user@example.com',
        emailVerified: null,
        id: 'user-id-123',
        image: null,
        name: null,
      };

      const result = mapAdapterUserToLobeUser(adapterUser);

      expect(result.emailVerifiedAt).toBeUndefined();
    });

    it('should wrap emailVerified string in a new Date', () => {
      const adapterUser = {
        email: 'user@example.com',
        emailVerified: new Date('2023-06-01'),
        id: 'user-id-456',
        image: null,
        name: 'Jane',
      };

      const result = mapAdapterUserToLobeUser(adapterUser);

      expect(result.emailVerifiedAt).toBeInstanceOf(Date);
    });

    it('should handle null image and name', () => {
      const adapterUser = {
        email: 'user@example.com',
        emailVerified: null,
        id: 'user-id-789',
        image: null,
        name: null,
      };

      const result = mapAdapterUserToLobeUser(adapterUser);

      expect(result.avatar).toBeNull();
      expect(result.fullName).toBeNull();
    });
  });

  describe('partialMapAdapterUserToLobeUser', () => {
    it('should map all provided fields to lobe user', () => {
      const emailVerifiedDate = new Date('2024-03-10');
      const partialUser = {
        email: 'partial@example.com',
        emailVerified: emailVerifiedDate,
        id: 'partial-id',
        image: 'https://example.com/photo.jpg',
        name: 'Partial User',
      };

      const result = partialMapAdapterUserToLobeUser(partialUser);

      expect(result).toEqual({
        avatar: 'https://example.com/photo.jpg',
        email: 'partial@example.com',
        emailVerifiedAt: emailVerifiedDate,
        fullName: 'Partial User',
        id: 'partial-id',
      });
    });

    it('should handle completely empty object', () => {
      const result = partialMapAdapterUserToLobeUser({});

      expect(result).toEqual({
        avatar: undefined,
        email: undefined,
        emailVerifiedAt: undefined,
        fullName: undefined,
        id: undefined,
      });
    });

    it('should set emailVerifiedAt to undefined when emailVerified is null', () => {
      const result = partialMapAdapterUserToLobeUser({ emailVerified: null });

      expect(result.emailVerifiedAt).toBeUndefined();
    });

    it('should map only provided fields', () => {
      const result = partialMapAdapterUserToLobeUser({ name: 'Only Name' });

      expect(result.fullName).toBe('Only Name');
      expect(result.email).toBeUndefined();
      expect(result.id).toBeUndefined();
    });
  });

  describe('mapLobeUserToAdapterUser', () => {
    it('should map all fields from lobe user to adapter user', () => {
      const emailVerifiedDate = new Date('2024-02-20');
      const lobeUser = {
        avatar: 'https://example.com/avatar.png',
        email: 'lobe@example.com',
        emailVerifiedAt: emailVerifiedDate,
        fullName: 'Lobe User',
        id: 'lobe-id-123',
      };

      const result = mapLobeUserToAdapterUser(lobeUser);

      expect(result).toEqual({
        email: 'lobe@example.com',
        emailVerified: emailVerifiedDate,
        id: 'lobe-id-123',
        image: 'https://example.com/avatar.png',
        name: 'Lobe User',
      });
    });

    it('should return empty string when email is null', () => {
      const lobeUser = {
        avatar: null,
        email: null,
        emailVerifiedAt: null,
        fullName: null,
        id: 'lobe-id-456',
      };

      const result = mapLobeUserToAdapterUser(lobeUser);

      expect(result.email).toBe('');
    });

    it('should return null emailVerified when emailVerifiedAt is null', () => {
      const lobeUser = {
        avatar: null,
        email: 'user@example.com',
        emailVerifiedAt: null,
        fullName: null,
        id: 'lobe-id-789',
      };

      const result = mapLobeUserToAdapterUser(lobeUser);

      expect(result.emailVerified).toBeNull();
    });

    it('should return null emailVerified when emailVerifiedAt is undefined', () => {
      const lobeUser = {
        avatar: null,
        email: 'user@example.com',
        emailVerifiedAt: undefined,
        fullName: null,
        id: 'lobe-id-000',
      };

      const result = mapLobeUserToAdapterUser(lobeUser);

      expect(result.emailVerified).toBeNull();
    });

    it('should map emailVerifiedAt as a Date instance', () => {
      const emailVerifiedDate = new Date('2024-05-01');
      const lobeUser = {
        avatar: null,
        email: 'user@example.com',
        emailVerifiedAt: emailVerifiedDate,
        fullName: null,
        id: 'lobe-id-111',
      };

      const result = mapLobeUserToAdapterUser(lobeUser);

      expect(result.emailVerified).toBeInstanceOf(Date);
      expect(result.emailVerified).toEqual(emailVerifiedDate);
    });
  });

  describe('mapAuthenticatorQueryResutlToAdapterAuthenticator', () => {
    it('should map all fields and convert null transports to undefined', () => {
      const authenticator = {
        counter: 5,
        credentialBackedUp: true,
        credentialDeviceType: 'singleDevice',
        credentialID: 'cred-id-123',
        credentialPublicKey: 'public-key-data',
        providerAccountId: 'provider-account-id',
        transports: null,
        userId: 'user-id-123',
      };

      const result = mapAuthenticatorQueryResutlToAdapterAuthenticator(authenticator);

      expect(result.transports).toBeUndefined();
      expect(result.counter).toBe(5);
      expect(result.credentialID).toBe('cred-id-123');
      expect(result.credentialBackedUp).toBe(true);
      expect(result.credentialDeviceType).toBe('singleDevice');
      expect(result.credentialPublicKey).toBe('public-key-data');
      expect(result.providerAccountId).toBe('provider-account-id');
      expect(result.userId).toBe('user-id-123');
    });

    it('should preserve non-null transports string', () => {
      const authenticator = {
        counter: 0,
        credentialBackedUp: false,
        credentialDeviceType: 'multiDevice',
        credentialID: 'cred-id-456',
        credentialPublicKey: 'pk-data',
        providerAccountId: 'provider-456',
        transports: 'usb,nfc',
        userId: 'user-456',
      };

      const result = mapAuthenticatorQueryResutlToAdapterAuthenticator(authenticator);

      expect(result.transports).toBe('usb,nfc');
    });

    it('should spread all other fields unchanged', () => {
      const authenticator = {
        counter: 42,
        credentialBackedUp: true,
        credentialDeviceType: 'singleDevice',
        credentialID: 'cred-id-789',
        credentialPublicKey: 'pk-789',
        providerAccountId: 'provider-789',
        transports: null,
        userId: 'user-789',
      };

      const result = mapAuthenticatorQueryResutlToAdapterAuthenticator(authenticator);

      expect(result.counter).toBe(42);
      expect(result.credentialBackedUp).toBe(true);
      expect(result.credentialDeviceType).toBe('singleDevice');
      expect(result.credentialID).toBe('cred-id-789');
      expect(result.credentialPublicKey).toBe('pk-789');
      expect(result.providerAccountId).toBe('provider-789');
      expect(result.userId).toBe('user-789');
    });
  });
});
