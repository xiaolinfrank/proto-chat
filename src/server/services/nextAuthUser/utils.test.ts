import { describe, expect, it } from 'vitest';

import {
  mapAdapterUserToLobeUser,
  mapAuthenticatorQueryResutlToAdapterAuthenticator,
  mapLobeUserToAdapterUser,
  partialMapAdapterUserToLobeUser,
} from './utils';

describe('mapAdapterUserToLobeUser', () => {
  it('should map all fields correctly', () => {
    const now = new Date('2024-01-01T00:00:00.000Z');
    const adapterUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      image: 'https://example.com/avatar.png',
      emailVerified: now,
    };

    const result = mapAdapterUserToLobeUser(adapterUser);

    expect(result).toEqual({
      avatar: 'https://example.com/avatar.png',
      email: 'test@example.com',
      emailVerifiedAt: new Date('2024-01-01T00:00:00.000Z'),
      fullName: 'Test User',
      id: 'user-123',
    });
  });

  it('should set emailVerifiedAt to undefined when emailVerified is null', () => {
    const adapterUser = {
      id: 'user-456',
      email: 'no-verify@example.com',
      name: 'No Verify',
      image: null,
      emailVerified: null,
    };

    const result = mapAdapterUserToLobeUser(adapterUser);

    expect(result.emailVerifiedAt).toBeUndefined();
  });

  it('should handle null image and name', () => {
    const adapterUser = {
      id: 'user-789',
      email: 'minimal@example.com',
      name: null,
      image: null,
      emailVerified: null,
    };

    const result = mapAdapterUserToLobeUser(adapterUser);

    expect(result.avatar).toBeNull();
    expect(result.fullName).toBeNull();
  });
});

describe('partialMapAdapterUserToLobeUser', () => {
  it('should map provided fields correctly', () => {
    const now = new Date('2024-06-15T12:00:00.000Z');
    const partial = {
      id: 'user-partial',
      name: 'Partial User',
      email: 'partial@example.com',
      image: 'https://example.com/img.jpg',
      emailVerified: now,
    };

    const result = partialMapAdapterUserToLobeUser(partial);

    expect(result).toEqual({
      avatar: 'https://example.com/img.jpg',
      email: 'partial@example.com',
      emailVerifiedAt: new Date('2024-06-15T12:00:00.000Z'),
      fullName: 'Partial User',
      id: 'user-partial',
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
    const date = new Date('2025-01-01T00:00:00.000Z');
    const result = partialMapAdapterUserToLobeUser({ emailVerified: date });

    expect(result.emailVerifiedAt).toEqual(new Date('2025-01-01T00:00:00.000Z'));
  });
});

describe('mapLobeUserToAdapterUser', () => {
  it('should map all fields correctly', () => {
    const now = new Date('2024-03-10T08:00:00.000Z');
    const lobeUser = {
      id: 'lobe-user-1',
      fullName: 'Lobe User',
      email: 'lobe@example.com',
      avatar: 'https://example.com/lobe.png',
      emailVerifiedAt: now,
    };

    const result = mapLobeUserToAdapterUser(lobeUser);

    expect(result).toEqual({
      email: 'lobe@example.com',
      emailVerified: new Date('2024-03-10T08:00:00.000Z'),
      id: 'lobe-user-1',
      image: 'https://example.com/lobe.png',
      name: 'Lobe User',
    });
  });

  it('should use empty string when email is null', () => {
    const lobeUser = {
      id: 'lobe-user-2',
      fullName: 'No Email',
      email: null,
      avatar: null,
      emailVerifiedAt: null,
    };

    const result = mapLobeUserToAdapterUser(lobeUser);

    expect(result.email).toBe('');
  });

  it('should set emailVerified to null when emailVerifiedAt is null', () => {
    const lobeUser = {
      id: 'lobe-user-3',
      fullName: 'Unverified',
      email: 'unverified@example.com',
      avatar: null,
      emailVerifiedAt: null,
    };

    const result = mapLobeUserToAdapterUser(lobeUser);

    expect(result.emailVerified).toBeNull();
  });

  it('should set emailVerified to null when emailVerifiedAt is undefined', () => {
    const lobeUser = {
      id: 'lobe-user-4',
      fullName: 'No Date',
      email: 'nodateverify@example.com',
      avatar: null,
      emailVerifiedAt: undefined,
    };

    const result = mapLobeUserToAdapterUser(lobeUser);

    expect(result.emailVerified).toBeNull();
  });
});

describe('mapAuthenticatorQueryResutlToAdapterAuthenticator', () => {
  it('should map all fields correctly with null transports', () => {
    const authenticator = {
      counter: 5,
      credentialBackedUp: true,
      credentialDeviceType: 'singleDevice',
      credentialID: 'cred-id-123',
      credentialPublicKey: 'public-key-abc',
      providerAccountId: 'provider-account-1',
      transports: null,
      userId: 'user-auth-1',
    };

    const result = mapAuthenticatorQueryResutlToAdapterAuthenticator(authenticator);

    expect(result).toMatchObject({
      counter: 5,
      credentialBackedUp: true,
      credentialDeviceType: 'singleDevice',
      credentialID: 'cred-id-123',
      credentialPublicKey: 'public-key-abc',
      providerAccountId: 'provider-account-1',
      userId: 'user-auth-1',
    });
    expect(result.transports).toBeUndefined();
  });

  it('should preserve transports when not null', () => {
    const authenticator = {
      counter: 1,
      credentialBackedUp: false,
      credentialDeviceType: 'multiDevice',
      credentialID: 'cred-id-456',
      credentialPublicKey: 'public-key-xyz',
      providerAccountId: 'provider-account-2',
      transports: 'usb,nfc',
      userId: 'user-auth-2',
    };

    const result = mapAuthenticatorQueryResutlToAdapterAuthenticator(authenticator);

    expect(result.transports).toBe('usb,nfc');
  });

  it('should spread all fields from authenticator', () => {
    const authenticator = {
      counter: 0,
      credentialBackedUp: false,
      credentialDeviceType: 'singleDevice',
      credentialID: 'cred-xyz',
      credentialPublicKey: 'pub-key',
      providerAccountId: 'acc-id',
      transports: null,
      userId: 'u1',
    };

    const result = mapAuthenticatorQueryResutlToAdapterAuthenticator(authenticator);

    expect(result.counter).toBe(0);
    expect(result.credentialBackedUp).toBe(false);
    expect(result.credentialDeviceType).toBe('singleDevice');
    expect(result.credentialID).toBe('cred-xyz');
    expect(result.credentialPublicKey).toBe('pub-key');
    expect(result.providerAccountId).toBe('acc-id');
    expect(result.userId).toBe('u1');
  });
});
