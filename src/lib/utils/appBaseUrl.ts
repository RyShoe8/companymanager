export function getAppBaseUrl(): string {
  const fromPublic = (process.env.NEXT_PUBLIC_APP_URL ?? '').trim();
  if (fromPublic) return fromPublic.replace(/\/$/, '');
  const fromAuth = (process.env.NEXTAUTH_URL ?? '').trim();
  if (fromAuth) return fromAuth.replace(/\/$/, '');
  return 'https://nucleas.app';
}
