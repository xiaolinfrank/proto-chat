import { AdapterAuthenticator, AdapterUser } from 'next-auth/adapters';
import { describe, expect, it } from 'vitest';

import {
  mapAdapterUserToLobeUser,
  mapAuthenticatorQueryResutlToAdapterAuthenticator,
  mapLobeUserToAdapterUser,
  partialMapAdapterUserToLobeUser,
} from './utils';

const baseAdapterUser: AdapterUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  image: 'https://example.com/avatar.jpg',
  emailVerified: new Date('2024-01-15T10:00:00Z'),
};

describe('nextAuthUser/utils', () => {
  describe('mapAdapterUserToLobeUser', () => {
    it('should map all fields correctly', () => {
      const result = mapAdapterUserToLobeUser(baseAdapterUser);

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
        emailVerifiedAt: new Date('2024-01-15T10:00:00Z'),
      });
    });

    it('should set emailVerifiedAt to undefined when emailVerified is null', () => {
      const user: AdapterUser = { ...baseAdapterUser, emailVerified: null };

      const result = mapAdapterUserToLobeUser(user);

      expect(result.emailVerifiedAt).toBeUndefined();
    });

    it('should handle null name and image', () => {
      const user: AdapterUser = { ...baseAdapterUser, name: null, image: null };

      const result = mapAdapterUserToLobeUser(user);

      expect(result.fullName).toBeNull();
      expect(result.avatar).toBeNull();
    });

    it('should preserve the id field', () => {
      const result = mapAdapterUserToLobeUser(baseAdapterUser);

      expect(result.id).toBe('user-123');
    });

    it('should convert emailVerified string-coercible date correctly', () => {
      const date = new Date('2023-06-01T00:00:00Z');
      const user: AdapterUser = { ...baseAdapterUser, emailVerified: date };

      const result = mapAdapterUserToLobeUser(user);

      expect(result.emailVerifiedAt).toEqual(new Date('2023-06-01T00:00:00Z'));
    });
  });

  describe('partialMapAdapterUserToLobeUser', () => {
    it('should map all provided fields', () => {
      const result = partialMapAdapterUserToLobeUser(baseAdapterUser);

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        fullName: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
        emailVerifiedAt: new Date('2024-01-15T10:00:00Z'),
      });
    });

    it('should handle empty object input', () => {
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

    it('should set emailVerifiedAt when emailVerified is provided', () => {
      const date = new Date('2024-03-10T12:00:00Z');
      const result = partialMapAdapterUserToLobeUser({ emailVerified: date });

      expect(result.emailVerifiedAt).toEqual(date);
    });

    it('should only map provided partial fields', () => {
      const result = partialMapAdapterUserToLobeUser({ id: 'partial-id', name: 'Partial' });

      expect(result.id).toBe('partial-id');
      expect(result.fullName).toBe('Partial');
      expect(result.email).toBeUndefined();
    });
  });

  describe('mapLobeUserToAdapterUser', () => {
    it('should map all fields correctly', () => {
      const lobeUser = {
        id: 'user-456',
        fullName: 'Lobe User',
        email: 'lobe@example.com',
        avatar: 'https://example.com/lobe.jpg',
        emailVerifiedAt: new Date('2024-02-20T08:00:00Z'),
      };

      const result = mapLobeUserToAdapterUser(lobeUser);

      expect(result).toEqual({
        id: 'user-456',
        name: 'Lobe User',
        email: 'lobe@example.com',
        image: 'https://example.com/lobe.jpg',
        emailVerified: new Date('2024-02-20T08:00:00Z'),
      });
    });

    it('should use empty string when email is null', () => {
      const lobeUser = {
        id: 'user-789',
        fullName: 'No Email User',
        email: null,
        avatar: null,
        emailVerifiedAt: null,
      };

      const result = mapLobeUserToAdapterUser(lobeUser);

      expect(result.email).toBe('');
    });

    it('should set emailVerified to null when emailVerifiedAt is null', () => {
      const lobeUser = {
        id: 'user-789',
        fullName: 'Unverified User',
        email: 'unverified@example.com',
        avatar: null,
        emailVerifiedAt: null,
      };

      const result = mapLobeUserToAdapterUser(lobeUser);

      expect(result.emailVerified).toBeNull();
    });

    it('should handle undefined emailVerifiedAt', () => {
      const lobeUser = {
        id: 'user-001',
        fullName: 'Test',
        email: 'test@example.com',
        avatar: null,
        emailVerifiedAt: undefined,
      };

      const result = mapLobeUserToAdapterUser(lobeUser);

      expect(result.emailVerified).toBeNull();
    });

    it('should map image from avatar field', () => {
      const lobeUser = {
        id: 'user-002',
        fullName: 'Avatar User',
        email: 'avatar@example.com',
        avatar: 'https://cdn.example.com/pic.png',
        emailVerifiedAt: null,
      };

      const result = mapLobeUserToAdapterUser(lobeUser);

      expect(result.image).toBe('https://cdn.example.com/pic.png');
    });
  });

  describe('mapAuthenticatorQueryResutlToAdapterAuthenticator', () => {
    const baseAuthenticator = {
      counter: 5,
      credentialBackedUp: true,
      credentialDeviceType: 'platform',
      credentialID: 'cred-abc123',
      credentialPublicKey: 'pubkey-xyz',
      providerAccountId: 'provider-account-1',
      transports: 'usb,nfc',
      userId: 'user-123',
    };

    it('should map all fields and keep non-null transports', () => {
      const result = mapAuthenticatorQueryResutlToAdapterAuthenticator(baseAuthenticator);

      expect(result).toEqual({
        counter: 5,
        credentialBackedUp: true,
        credentialDeviceType: 'platform',
        credentialID: 'cred-abc123',
        credentialPublicKey: 'pubkey-xyz',
        providerAccountId: 'provider-account-1',
        transports: 'usb,nfc',
        userId: 'user-123',
      });
    });

    it('should convert null transports to undefined', () => {
      const authenticator = { ...baseAuthenticator, transports: null };

      const result = mapAuthenticatorQueryResutlToAdapterAuthenticator(authenticator);

      expect(result.transports).toBeUndefined();
    });

    it('should preserve all numeric counter values', () => {
      const authenticator = { ...baseAuthenticator, counter: 0 };

      const result = mapAuthenticatorQueryResutlToAdapterAuthenticator(authenticator);

      expect(result.counter).toBe(0);
    });

    it('should correctly spread all authenticator fields', () => {
      const result = mapAuthenticatorQueryResutlToAdapterAuthenticator(baseAuthenticator);

      expect(result.credentialID).toBe('cred-abc123');
      expect(result.credentialPublicKey).toBe('pubkey-xyz');
      expect(result.providerAccountId).toBe('provider-account-1');
      expect(result.userId).toBe('user-123');
    });
  });
});
