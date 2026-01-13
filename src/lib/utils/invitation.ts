import crypto from 'crypto';

/**
 * Generate a secure random token for invitations
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate invitation link URL
 * Uses VERCEL_URL in production, NEXTAUTH_URL if set, or falls back to localhost
 */
export function getInvitationLink(token: string, baseUrl?: string): string {
  let url = baseUrl;
  
  if (!url) {
    // In Vercel, use VERCEL_URL (automatically set) or construct from headers
    if (process.env.VERCEL_URL) {
      // VERCEL_URL doesn't include protocol, so add https://
      const vercelUrl = process.env.VERCEL_URL;
      url = vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
    } else if (process.env.NEXT_PUBLIC_APP_URL) {
      url = process.env.NEXT_PUBLIC_APP_URL;
    } else if (process.env.NEXTAUTH_URL) {
      url = process.env.NEXTAUTH_URL;
    } else {
      url = 'http://localhost:3000';
    }
  }
  
  // Ensure URL doesn't have trailing slash
  url = url.replace(/\/$/, '');
  
  return `${url}/register?token=${token}`;
}
