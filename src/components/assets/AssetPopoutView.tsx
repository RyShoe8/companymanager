'use client';

import { useCallback, useEffect, useState } from 'react';
import type { IAsset } from '@/lib/models/Asset';

interface AssetPopoutViewProps {
  assetId: string;
  popout?: boolean;
}

function isImageAsset(asset: IAsset): boolean {
  const type = asset.type?.toLowerCase() ?? '';
  if (type === 'screenshot' || type === 'file') {
    const fileUrl = asset.fileUrl ?? '';
    return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(fileUrl) || fileUrl.startsWith('data:image/');
  }
  return false;
}

export default function AssetPopoutView({ assetId, popout = false }: AssetPopoutViewProps) {
  const [asset, setAsset] = useState<IAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!assetId) return;
    try {
      const res = await fetch(`/api/assets/${assetId}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to load asset');
        setAsset(null);
      } else {
        setAsset(json);
        setError(null);
      }
    } catch {
      setError('Failed to load asset');
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    void load();
  }, [load]);

  const shellClass = popout
    ? 'h-dvh overflow-y-auto overscroll-contain bg-background text-text-primary'
    : 'min-h-screen bg-background text-text-primary';

  if (loading) {
    return (
      <div className={`${shellClass} flex items-center justify-center px-6 py-16`}>
        <p className="text-text-muted">Loading asset…</p>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className={`${shellClass} px-6 py-16 text-center`}>
        <p className="text-red-400 mb-2">{error || 'Asset not found'}</p>
      </div>
    );
  }

  const fileUrl = asset.fileUrl?.trim();
  const textContent = asset.textContent?.trim();
  const externalUrl = asset.url?.trim();
  const showImage = fileUrl && isImageAsset(asset);

  return (
    <div className={`${shellClass} ${popout ? 'px-4 py-4' : 'px-6 py-8'}`}>
      <div className={popout ? 'max-w-4xl mx-auto space-y-4' : 'max-w-3xl mx-auto space-y-4'}>
        <header>
          <h1 className={`font-bold ${popout ? 'text-xl' : 'text-2xl'}`}>{asset.name}</h1>
          <p className="text-sm text-text-muted mt-1">
            {asset.type === 'text' ? 'Note' : asset.type}
          </p>
        </header>

        <div className="rounded-lg border border-border bg-background-card p-4">
          {showImage && fileUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl}
              alt={asset.name}
              className="max-w-full h-auto mx-auto rounded"
            />
          ) : textContent || asset.type === 'text' ? (
            <pre className="text-sm whitespace-pre-wrap text-text-primary font-sans bg-background-elevated rounded-lg p-3 max-h-[70vh] overflow-y-auto">
              {textContent || 'No content yet.'}
            </pre>
          ) : externalUrl && (asset.type === 'document' || asset.type === 'spreadsheet' || asset.type === 'file') ? (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">Open this file in Google.</p>
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-sm text-primary hover:text-primary-hover underline"
              >
                Open in Google
              </a>
            </div>
          ) : fileUrl ? (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">Open or download this file.</p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-sm text-primary hover:text-primary-hover underline"
              >
                Open file
              </a>
            </div>
          ) : externalUrl ? (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:text-primary-hover underline break-all"
            >
              {externalUrl}
            </a>
          ) : (
            <p className="text-sm text-text-secondary">No preview available for this asset.</p>
          )}
        </div>
      </div>
    </div>
  );
}
