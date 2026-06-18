import crypto from 'crypto';
import { getAppBaseUrl } from '@/lib/utils/invitation';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export function generateEmailVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashEmailVerificationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getEmailVerificationExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + VERIFICATION_TTL_MS);
}

export function getEmailVerificationLink(token: string, baseUrl?: string): string {
  const url = (baseUrl ?? getAppBaseUrl()).replace(/\/$/, '');
  return `${url}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
}

/** Legacy accounts without a verification token are treated as verified. */
export function isLegacyVerifiedUser(user: {
  emailVerified?: boolean;
  emailVerificationTokenHash?: string | null;
}): boolean {
  return user.emailVerified === true || !user.emailVerificationTokenHash;
}

export function isEmailVerificationPending(user: {
  emailVerified?: boolean;
  emailVerificationTokenHash?: string | null;
}): boolean {
  return user.emailVerified !== true && !!user.emailVerificationTokenHash;
}

/** Grandfather existing users who never had a verification token. */
export async function migrateLegacyEmailVerified(user: {
  emailVerified?: boolean;
  emailVerificationTokenHash?: string | null;
  save: () => Promise<unknown>;
}): Promise<void> {
  if (user.emailVerified === true) return;
  if (!user.emailVerificationTokenHash) {
    user.emailVerified = true;
    await user.save();
  }
}
