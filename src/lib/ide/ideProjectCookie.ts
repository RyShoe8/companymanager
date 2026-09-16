/** Client-readable cookie mirroring localStorage last real project (not Free Chat). */
export const IDE_LAST_PROJECT_COOKIE = 'nucleas.ide.lastProjectId';

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export function isRealIdeProjectId(value: string | null | undefined): value is string {
  return Boolean(value && OBJECT_ID_RE.test(value.trim()));
}

/** Set on the client when the user selects a real project. */
export function setClientIdeProjectCookie(projectId: string): void {
  if (typeof document === 'undefined') return;
  const id = projectId.trim();
  if (!isRealIdeProjectId(id)) return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${IDE_LAST_PROJECT_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearClientIdeProjectCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${IDE_LAST_PROJECT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
