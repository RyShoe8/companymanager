import { describe, expect, it } from 'vitest';
import {
  generateEmailVerificationToken,
  hashEmailVerificationToken,
  getEmailVerificationLink,
  isEmailVerificationPending,
  isLegacyVerifiedUser,
} from '@/lib/auth/emailVerification';

describe('emailVerification', () => {
  it('generates unique tokens and stable hashes', () => {
    const a = generateEmailVerificationToken();
    const b = generateEmailVerificationToken();
    expect(a).not.toBe(b);
    expect(a).toHaveLength(64);
    expect(hashEmailVerificationToken(a)).toHaveLength(64);
    expect(hashEmailVerificationToken(a)).toBe(hashEmailVerificationToken(a));
  });

  it('builds verification links with encoded token', () => {
    const link = getEmailVerificationLink('abc+def', 'https://app.example.com');
    expect(link).toBe('https://app.example.com/api/auth/verify-email?token=abc%2Bdef');
  });

  it('detects pending verification', () => {
    expect(
      isEmailVerificationPending({ emailVerified: false, emailVerificationTokenHash: 'hash' })
    ).toBe(true);
    expect(isEmailVerificationPending({ emailVerified: true, emailVerificationTokenHash: 'hash' })).toBe(
      false
    );
    expect(isEmailVerificationPending({ emailVerified: false, emailVerificationTokenHash: null })).toBe(false);
  });

  it('treats legacy users without token hash as verified', () => {
    expect(isLegacyVerifiedUser({ emailVerified: false, emailVerificationTokenHash: undefined })).toBe(
      true
    );
    expect(isLegacyVerifiedUser({ emailVerified: true, emailVerificationTokenHash: 'x' })).toBe(true);
    expect(isLegacyVerifiedUser({ emailVerified: false, emailVerificationTokenHash: 'x' })).toBe(false);
  });
});
