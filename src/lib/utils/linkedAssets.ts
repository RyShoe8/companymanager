import type { PendingAssetPayload } from '@/components/checklist/categoryModalTypes';

async function createLinkedAsset(payload: PendingAssetPayload): Promise<boolean> {
  const res = await fetch('/api/assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

export async function createPendingAssets(
  contentItemId: string,
  pending: PendingAssetPayload[]
): Promise<void> {
  for (const asset of pending) {
    await createLinkedAsset({ ...asset, linkedContentItemId: contentItemId });
  }
}

export type LinkedAssetChip = {
  _id: string;
  name: string;
  type: string;
  url?: string;
  fileUrl?: string;
  userId?: string;
};

export function normalizeAssetUserId(userId: unknown): string | undefined {
  if (typeof userId === 'string') return userId;
  if (userId && typeof (userId as { toString?: () => string }).toString === 'function') {
    return (userId as { toString: () => string }).toString();
  }
  return undefined;
}

export function canUserDeleteAsset(
  assetUserId: unknown,
  currentUserId: string | undefined,
  isManagerOrAdmin: boolean
): boolean {
  if (isManagerOrAdmin) return true;
  if (!currentUserId) return false;
  return normalizeAssetUserId(assetUserId) === currentUserId;
}

export function normalizeLinkedAssetChip(raw: unknown): LinkedAssetChip | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = o._id;
  const idStr =
    typeof id === 'string'
      ? id
      : id && typeof (id as { toString?: () => string }).toString === 'function'
        ? (id as { toString: () => string }).toString()
        : '';
  if (!idStr) return null;
  return {
    _id: idStr,
    name: typeof o.name === 'string' ? o.name : 'Untitled',
    type: typeof o.type === 'string' ? o.type : 'other',
    url: typeof o.url === 'string' ? o.url : undefined,
    fileUrl: typeof o.fileUrl === 'string' ? o.fileUrl : undefined,
    userId: normalizeAssetUserId(o.userId),
  };
}

export function linkedAssetHref(asset: LinkedAssetChip): string | null {
  if (asset.fileUrl) return asset.fileUrl;
  if (asset.url) return asset.url;
  return null;
}

export function isTextDocumentAssetType(type: string): boolean {
  return type === 'text';
}

/** Capitalized display label for a linked asset type (e.g. "image" -> "Image"). */
export function formatLinkedAssetTypeLabel(type: string): string {
  if (!type) return 'Other';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export async function deleteLinkedAsset(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/assets/${id}`, { method: 'DELETE' });
    if (res.ok) return { ok: true };
    let error = 'Could not delete asset.';
    try {
      const data = await res.json();
      if (data && typeof data.error === 'string') error = data.error;
    } catch {
      // ignore
    }
    return { ok: false, error };
  } catch {
    return { ok: false, error: 'Could not delete asset.' };
  }
}
