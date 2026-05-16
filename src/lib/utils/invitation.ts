import crypto from 'crypto';

/**
 * Generate a secure random token for invitations
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Canonical public app URL for user-facing links (emails, invites).
 * Never uses VERCEL_URL — that is a deployment hostname, not the product domain.
 */
export function getAppBaseUrl(): string {
  const nextAuth = process.env.NEXTAUTH_URL?.trim();
  if (nextAuth) return nextAuth.replace(/\/$/, '');

  const publicUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (publicUrl) return publicUrl.replace(/\/$/, '');

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }

  return 'https://nucleas.app';
}

/**
 * Generate invitation link URL for employee org invites (/register?token=...)
 */
export function getInvitationLink(token: string, baseUrl?: string): string {
  const url = (baseUrl ?? getAppBaseUrl()).replace(/\/$/, '');
  return `${url}/register?token=${token}`;
}
