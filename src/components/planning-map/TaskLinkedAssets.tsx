'use client';

import { useCallback, useEffect, useState } from 'react';
import { IProject } from '@/lib/models/Project';
import AddButton from '@/components/checklist/AddButton';
import ImagePreviewModal from '@/components/shared/ImagePreviewModal';
import HoverDeleteButton from '@/components/shared/HoverDeleteButton';
import AssetDeleteConfirmModal from '@/components/shared/AssetDeleteConfirmModal';
import { mapStatusToStage } from '@/lib/utils/statusMapping';
import {
  deleteLinkedAsset,
  canUserDeleteAsset,
  linkedAssetHref,
  normalizeLinkedAssetChip,
  type LinkedAssetChip,
} from '@/lib/utils/linkedAssets';

interface TaskLinkedAssetsProps {
  project: IProject;
  taskId?: string;
  isManagerOrAdmin: boolean;
}

const chipClass =
  'relative group text-xs px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:underline inline-flex items-center max-w-full';

export default function TaskLinkedAssets({ project, taskId, isManagerOrAdmin }: TaskLinkedAssetsProps) {
  const [linkedAssets, setLinkedAssets] = useState<LinkedAssetChip[]>([]);
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);
  const [assetPendingDelete, setAssetPendingDelete] = useState<LinkedAssetChip | null>(null);
  const [deletingAsset, setDeletingAsset] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const projectId = project._id.toString();
  const phase = mapStatusToStage(project.status);
  const projectType = project.projectType || 'generic';

  const loadLinkedAssets = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await fetch(`/api/assets?linkedProjectTaskId=${taskId}`);
      if (!res.ok) {
        setLinkedAssets([]);
        return;
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        setLinkedAssets([]);
        return;
      }
      setLinkedAssets(data.map(normalizeLinkedAssetChip).filter((x): x is LinkedAssetChip => x != null));
    } catch {
      setLinkedAssets([]);
    }
  }, [taskId]);

  useEffect(() => {
    void loadLinkedAssets();
  }, [loadLinkedAssets]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.id && setCurrentUserId(data.id))
      .catch(() => {});
  }, []);

  const confirmDeleteAsset = async () => {
    if (!assetPendingDelete) return;
    setDeletingAsset(true);
    const result = await deleteLinkedAsset(assetPendingDelete._id);
    if (result.ok) {
      setAssetPendingDelete(null);
      if (previewImage && assetPendingDelete.fileUrl === previewImage.src) {
        setPreviewImage(null);
      }
      await loadLinkedAssets();
    } else {
      alert(result.error ?? 'Could not delete asset.');
    }
    setDeletingAsset(false);
  };

  if (!isManagerOrAdmin && linkedAssets.length === 0) return null;

  const renderDelete = (asset: LinkedAssetChip) =>
    canUserDeleteAsset(asset.userId, currentUserId, isManagerOrAdmin) ? (
      <HoverDeleteButton
        label={`Delete ${asset.name}`}
        onClick={() => setAssetPendingDelete(asset)}
      />
    ) : null;

  return (
    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
      <LinkedAssetsHeader />
      {isManagerOrAdmin && taskId && (
        <AddButton
          projectId={projectId}
          phase={phase}
          projectType={projectType}
          isManagerOrAdmin={isManagerOrAdmin}
          label="Add"
          linkContext={{
            linkedProjectId: projectId,
            linkedProjectTaskId: taskId,
          }}
          onDocumentCreated={() => void loadLinkedAssets()}
          onAddButton={async () => {}}
        />
      )}
      {!taskId && isManagerOrAdmin && (
        <p className="text-xs text-gray-500 mt-1">Save the task to attach assets.</p>
      )}
      {linkedAssets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {linkedAssets.map((asset) => {
            if (asset.type === 'screenshot' && asset.fileUrl) {
              return (
                <span key={asset._id} className={chipClass}>
                  <button
                    type="button"
                    onClick={() => setPreviewImage({ src: asset.fileUrl!, title: asset.name })}
                    className="truncate"
                  >
                    {asset.name}
                  </button>
                  {renderDelete(asset)}
                </span>
              );
            }

            const href = linkedAssetHref(asset);
            if (href) {
              return (
                <span key={asset._id} className={chipClass}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate"
                  >
                    {asset.name}
                  </a>
                  {renderDelete(asset)}
                </span>
              );
            }

            return (
              <span key={asset._id} className={`${chipClass} bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:no-underline`}>
                <span className="truncate">{asset.name}</span>
                {renderDelete(asset)}
              </span>
            );
          })}
        </div>
      )}
      <ImagePreviewModal
        isOpen={previewImage !== null}
        onClose={() => setPreviewImage(null)}
        src={previewImage?.src ?? null}
        title={previewImage?.title}
      />
      <AssetDeleteConfirmModal
        isOpen={assetPendingDelete !== null}
        assetName={assetPendingDelete?.name ?? ''}
        assetTypeLabel={assetPendingDelete?.type}
        deleting={deletingAsset}
        onCancel={() => {
          if (!deletingAsset) setAssetPendingDelete(null);
        }}
        onConfirm={() => void confirmDeleteAsset()}
      />
    </div>
  );
}

function LinkedAssetsHeader() {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
      Assets
    </p>
  );
}
