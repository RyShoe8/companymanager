'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { IProject } from '@/lib/models/Project';
import AddButton from '@/components/checklist/AddButton';
import type { PendingAssetPayload } from '@/components/checklist/CategoryModal';
import HoverDeleteButton from '@/components/shared/HoverDeleteButton';
import ImagePreviewModal from '@/components/shared/ImagePreviewModal';
import AssetDeleteConfirmModal from '@/components/shared/AssetDeleteConfirmModal';
import LinkedAssetDocumentSheet, { type LinkedAssetDocument } from '@/components/shared/LinkedAssetDocumentSheet';
import { mapStatusToStage } from '@/lib/utils/statusMapping';
import {
  canUserDeleteAsset,
  deleteLinkedAsset,
  linkedAssetHref,
  normalizeLinkedAssetChip,
  type LinkedAssetChip,
} from '@/lib/utils/linkedAssets';
import { useInspectorLight, lightSurface } from '@/contexts/InspectorLightContext';

function isTextDocumentAssetType(type: string): boolean {
  return type === 'text' || type === 'document';
}

function formatLinkedAssetTypeLabel(type: string): string {
  if (!type) return 'Other';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

interface ContentItemAssetsSectionProps {
  project: IProject;
  contentItemId?: string;
  isManagerOrAdmin: boolean;
  currentUserId?: string;
  currentUserEmployeeId?: string | null;
  assignedToEmployeeId?: string;
  mode?: 'live' | 'draft';
  pendingAssets?: PendingAssetPayload[];
  onPendingAsset?: (asset: PendingAssetPayload) => void;
  onRemovePendingAsset?: (index: number) => void;
  refreshToken?: number;
  compact?: boolean;
  onAssetsChanged?: () => void;
  nestedInModal?: boolean;
}

export default function ContentItemAssetsSection({
  project,
  contentItemId,
  isManagerOrAdmin,
  currentUserId,
  currentUserEmployeeId,
  assignedToEmployeeId,
  mode = 'live',
  pendingAssets = [],
  onPendingAsset,
  onRemovePendingAsset,
  refreshToken = 0,
  compact = false,
  onAssetsChanged,
  nestedInModal = false,
}: ContentItemAssetsSectionProps) {
  const light = useInspectorLight();
  const [assets, setAssets] = useState<LinkedAssetChip[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);
  const [previewDocument, setPreviewDocument] = useState<LinkedAssetDocument | null>(null);
  const [assetPendingDelete, setAssetPendingDelete] = useState<LinkedAssetChip | null>(null);
  const [deletingAsset, setDeletingAsset] = useState(false);

  const projectId = project._id.toString();
  const phase = mapStatusToStage(project.status);
  const projectType = project.projectType || 'generic';

  const canAddAssets =
    isManagerOrAdmin ||
    (mode === 'draft' && !!onPendingAsset) ||
    (!!assignedToEmployeeId &&
      !!currentUserEmployeeId &&
      assignedToEmployeeId === currentUserEmployeeId);

  const loadAssets = useCallback(async () => {
    if (!contentItemId || mode === 'draft') {
      setAssets([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/assets?linkedContentItemId=${contentItemId}`);
      if (!res.ok) {
        setAssets([]);
        return;
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        setAssets([]);
        return;
      }
      setAssets(data.map(normalizeLinkedAssetChip).filter((x): x is LinkedAssetChip => x != null));
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [contentItemId, mode]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets, refreshToken]);

  const confirmDeleteAsset = async () => {
    if (!assetPendingDelete) return;
    setDeletingAsset(true);
    const result = await deleteLinkedAsset(assetPendingDelete._id);
    if (result.ok) {
      if (previewImage && linkedAssetHref(assetPendingDelete) === previewImage.src) {
        setPreviewImage(null);
      }
      if (previewDocument?._id === assetPendingDelete._id) {
        setPreviewDocument(null);
      }
      setAssetPendingDelete(null);
      await loadAssets();
    } else {
      alert(result.error ?? 'Could not delete asset.');
    }
    setDeletingAsset(false);
  };

  const chipClass = compact
    ? 'relative group inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium text-primary max-w-[220px]'
    : 'relative group inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary max-w-[260px]';

  const renderAssetChip = (asset: LinkedAssetChip) => {
    const href = linkedAssetHref(asset);
    const deleteBtn = canUserDeleteAsset(asset.userId, currentUserId, isManagerOrAdmin) ? (
      <HoverDeleteButton label={`Delete asset ${asset.name}`} onClick={() => setAssetPendingDelete(asset)} />
    ) : null;

    if (isTextDocumentAssetType(asset.type)) {
      return (
        <span key={asset._id} className={`${chipClass} max-w-[280px]`}>
          <button
            type="button"
            onClick={() => {
              void fetch(`/api/assets/${asset._id}`)
                .then((res) => (res.ok ? res.json() : null))
                .then((data) => {
                  setPreviewDocument({
                    _id: asset._id,
                    name: typeof data?.name === 'string' ? data.name : asset.name,
                    textContent: typeof data?.textContent === 'string' ? data.textContent : '',
                  });
                })
                .catch(() => {
                  setPreviewDocument({ _id: asset._id, name: asset.name, textContent: '' });
                });
            }}
            className="truncate flex-1 min-w-0 text-left hover:underline touch-manipulation"
          >
            {asset.name}
          </button>
          {deleteBtn}
        </span>
      );
    }

    if ((asset.type === 'screenshot' || asset.type === 'image') && href) {
      return (
        <span key={asset._id} className={`${chipClass} max-w-[280px]`}>
          <button
            type="button"
            onClick={() => setPreviewImage({ src: href, title: asset.name })}
            className="truncate hover:underline min-w-0 flex-1 text-left touch-manipulation"
          >
            {asset.name}
          </button>
          {deleteBtn}
        </span>
      );
    }

    if (href) {
      return (
        <span key={asset._id} className={`${chipClass} max-w-[280px]`}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate hover:underline min-w-0 flex-1"
            onClick={(e) => e.stopPropagation()}
          >
            {asset.name}
          </a>
          {deleteBtn}
        </span>
      );
    }

    return (
      <span key={asset._id} className={`${chipClass} max-w-[280px]`}>
        <span className="truncate min-w-0 flex-1">{asset.name}</span>
        <span className="text-xs shrink-0 opacity-80">· {formatLinkedAssetTypeLabel(asset.type)}</span>
        {deleteBtn}
      </span>
    );
  };

  return (
    <>
      <div className={lightSurface(compact ? 'mt-2 pt-2 border-t border-gray-100' : 'pt-2 border-t border-border', 'dark:border-gray-700', light)}>
        {!compact && (
          <label className="block text-sm font-medium text-text-primary mb-2">Assets</label>
        )}
        {canAddAssets && (
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <AddButton
              projectId={projectId}
              phase={phase}
              projectType={projectType}
              isManagerOrAdmin={isManagerOrAdmin}
              label={compact ? 'Add' : 'Add asset'}
              mode={mode}
              linkContext={{
                linkedProjectId: projectId,
                ...(contentItemId ? { linkedContentItemId: contentItemId } : {}),
              }}
              onPendingAsset={onPendingAsset}
              onDocumentCreated={() => {
                void loadAssets();
                onAssetsChanged?.();
              }}
              onAddButton={async () => {}}
              stackAboveLightbox={nestedInModal}
            />
          </div>
        )}
        {mode === 'draft' && pendingAssets.length > 0 && (
          <ul className="space-y-1 mb-2">
            {pendingAssets.map((asset, index) => (
              <li
                key={`${asset.name}-${index}`}
                className="flex items-center justify-between gap-2 text-sm text-text-secondary"
              >
                <span className="truncate">{asset.name}</span>
                <button
                  type="button"
                  onClick={() => onRemovePendingAsset?.(index)}
                  className="text-error hover:opacity-80 text-xs shrink-0"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {mode === 'live' && loading && (
          <p className="text-xs text-text-secondary">Loading assets…</p>
        )}
        {mode === 'live' && !loading && assets.length === 0 && (
          <p className="text-xs text-text-secondary">
            No assets linked yet.{canAddAssets ? ' Use Add to attach files or documents.' : ''}
          </p>
        )}
        {mode === 'live' && assets.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">{assets.map(renderAssetChip)}</div>
        )}
        {!compact && projectId && (
          <Link
            href={`/assets?projectId=${projectId}`}
            className="inline-block mt-2 text-xs text-text-secondary hover:text-text-primary underline"
          >
            View all project assets
          </Link>
        )}
      </div>

      <ImagePreviewModal
        isOpen={previewImage !== null}
        onClose={() => setPreviewImage(null)}
        src={previewImage?.src ?? null}
        title={previewImage?.title}
        stackAboveLightbox={nestedInModal}
      />
      <LinkedAssetDocumentSheet
        asset={previewDocument}
        isOpen={previewDocument !== null}
        onClose={() => setPreviewDocument(null)}
        projectId={projectId}
        stackAboveLightbox={nestedInModal}
        onSaved={(updated) => {
          setAssets((prev) =>
            prev.map((a) =>
              a._id === previewDocument?._id ? { ...a, name: updated.name } : a
            )
          );
          setPreviewDocument((prev) =>
            prev ? { ...prev, name: updated.name, textContent: updated.textContent } : null
          );
        }}
      />
      <AssetDeleteConfirmModal
        isOpen={assetPendingDelete !== null}
        assetName={assetPendingDelete?.name ?? ''}
        onCancel={() => setAssetPendingDelete(null)}
        onConfirm={() => void confirmDeleteAsset()}
        deleting={deletingAsset}
        stackAboveLightbox={nestedInModal}
      />
    </>
  );
}
