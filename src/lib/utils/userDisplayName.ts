/** First name for UI labels from profile name or email. */
export function userFirstNameFromProfile(name?: string | null, email?: string | null): string {
  const fromName = name?.trim().split(/\s+/)[0];
  if (fromName) return fromName.slice(0, 40);
  const local = email?.trim().split('@')[0]?.trim();
  if (local) return local.slice(0, 40);
  return 'You';
}
