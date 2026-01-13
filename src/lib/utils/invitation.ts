import crypto from 'crypto';

/**
 * Generate a secure random token for invitations
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate invitation link URL
 */
export function getInvitationLink(token: string, baseUrl?: string): string {
  const url = baseUrl || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${url}/register?token=${token}`;
}
