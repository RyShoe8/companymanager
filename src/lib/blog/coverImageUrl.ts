export const COVER_IMAGE_URL_MAX = 500;

export function isValidCoverImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.length > COVER_IMAGE_URL_MAX) return false;
  if (trimmed.startsWith('/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function coverImageUrlError(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.length > COVER_IMAGE_URL_MAX) {
    return `Cover image URL is too long (max ${COVER_IMAGE_URL_MAX} characters)`;
  }
  if (!isValidCoverImageUrl(trimmed)) {
    return 'Cover image URL must be a valid http(s) URL or site path';
  }
  return null;
}
