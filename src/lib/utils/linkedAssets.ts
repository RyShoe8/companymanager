import type { PendingAssetPayload } from '@/components/checklist/CategoryModal';

export async function createLinkedAsset(payload: PendingAssetPayload): Promise<boolean> {
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
};

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
  };
}

export function linkedAssetHref(asset: LinkedAssetChip): string | null {
  if (asset.fileUrl) return asset.fileUrl;
  if (asset.url) return asset.url;
  return null;
}
