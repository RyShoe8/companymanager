/**
 * Normalize stored URL for use as `href` (add https when scheme omitted).
 * Only http/https schemes are allowed; anything else (javascript:, data:, etc.) returns null.
 */
export function normalizeProjectUrlHref(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) {
    return /^https?:/i.test(t) ? t : null;
  }
  if (t.startsWith('//')) return `https:${t}`;
  return `https://${t}`;
}

export function truncateProjectUrlDisplay(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}
