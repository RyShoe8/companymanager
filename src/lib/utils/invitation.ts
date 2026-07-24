import crypto from 'crypto';
import { getAppBaseUrl } from '@/lib/utils/appBaseUrl';

export { getAppBaseUrl };

/**
 * Generate a secure random token for invitations
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate invitation link URL for employee org invites (/register?token=...)
 */
export function getInvitationLink(token: string, baseUrl?: string): string {
  const url = (baseUrl ?? getAppBaseUrl()).replace(/\/$/, '');
  return `${url}/register?token=${token}`;
}
