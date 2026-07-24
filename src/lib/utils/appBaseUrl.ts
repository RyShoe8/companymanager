/**
 * Canonical public app URL for user-facing links (emails, invites, redirects).
 * Never uses VERCEL_URL — that is a deployment hostname, not the product domain.
 *
 * Precedence: NEXT_PUBLIC_APP_URL → NEXTAUTH_URL → localhost (dev) → production default.
 */
export function getAppBaseUrl(): string {
  const fromPublic = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim();
  if (fromPublic) return fromPublic.replace(/\/$/, '');

  const fromAuth = (process.env.NEXTAUTH_URL ?? '').trim();
  if (fromAuth) return fromAuth.replace(/\/$/, '');

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }

  return 'https://nucleas.app';
}
