import type { IPlatformOperationsFields } from '@/lib/models/platformFields';

type PlatformUrlFields = Pick<IPlatformOperationsFields, 'url' | 'urls' | 'devUrl' | 'liveUrl'>;

/** Merge legacy single-url fields into one deduplicated list for display. */
export function getPlatformUrlList(entity: PlatformUrlFields): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const add = (raw?: string | null) => {
    const trimmed = raw?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    result.push(trimmed);
  };

  add(entity.devUrl);
  add(entity.liveUrl);
  for (const url of entity.urls ?? []) add(url);
  add(entity.url);

  return result;
}

/** Persist a URL list and keep devUrl/liveUrl in sync for legacy consumers. */
export function syncPlatformUrlFields(
  urls: string[]
): Pick<IPlatformOperationsFields, 'urls' | 'devUrl' | 'liveUrl'> {
  const cleaned = urls.map((u) => u.trim()).filter(Boolean);
  const deduped = [...new Set(cleaned)];

  return {
    urls: deduped,
    devUrl: deduped[0],
    liveUrl: deduped[1],
  };
}
