'use client';

import { useCallback, useEffect, useState } from 'react';
import { IProject } from '@/lib/models/Project';
import AddButton from '@/components/checklist/AddButton';
import HoverDeleteButton from '@/components/shared/HoverDeleteButton';
import ImagePreviewModal from '@/components/shared/ImagePreviewModal';
import AssetDeleteConfirmModal from '@/components/shared/AssetDeleteConfirmModal';
import LinkedAssetDocumentSheet, { type LinkedAssetDocument } from '@/components/shared/LinkedAssetDocumentSheet';
import { mapStatusToStage } from '@/lib/utils/statusMapping';
import { getTaskAssigneeEmployeeIds } from '@/lib/utils/projectTeam';
import LinkedRecordingChips from '@/components/shared/LinkedRecordingChips';
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
  return type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Other';
}

interface TaskLinkedAssetsProps {
  project: IProject;
  taskId?: string;
  taskIndex?: number;
  isManagerOrAdmin: boolean;
  currentUserId?: string;
  currentUserEmployeeId?: string | null;
  refreshToken?: number;
  onAssetsChanged?: () => void;
  showAddHintText?: boolean;
}

export default function TaskLinkedAssets({
  project,
  taskId,
  taskIndex,
  isManagerOrAdmin,
  currentUserId,
  currentUserEmployeeId,
  refreshToken = 0,
  onAssetsChanged,
  showAddHintText = true,
}: TaskLinkedAssetsProps) {
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

  const task =
    taskIndex !== undefined
      ? project.tasks?.[taskIndex]
      : taskId
        ? project.tasks?.find((t) => t._id?.toString() === taskId)
        : undefined;

  const isAssignedUser =
    !!currentUserEmployeeId &&
    !!task &&
    getTaskAssigneeEmployeeIds(task).includes(currentUserEmployeeId);

  const canViewAssets = isManagerOrAdmin || isAssignedUser;

  const canAddAssets = canViewAssets;

  const loadAssets = useCallback(async () => {
    if (!taskId && taskIndex == null) {
      setAssets([]);
      return;
    }
    setLoading(true);
    try {
      const chips: LinkedAssetChip[] = [];
      const seen = new Set<string>();

      const addFromResponse = (data: unknown) => {
        if (!Array.isArray(data)) return;
        for (const raw of data) {
          const chip = normalizeLinkedAssetChip(raw);
          if (chip && !seen.has(chip._id)) {
            seen.add(chip._id);
            chips.push(chip);
          }
        }
      };

      if (taskId) {
        const byIdRes = await fetch(
          `/api/assets?linkedProjectTaskId=${encodeURIComponent(taskId)}`
        );
        if (byIdRes.ok) {
          addFromResponse(await byIdRes.json());
        }
      }

      if (taskIndex != null) {
        const legacyRes = await fetch(
          `/api/assets?linkedProjectId=${encodeURIComponent(projectId)}&linkedProjectTaskIndex=${taskIndex}`
        );
        if (legacyRes.ok) {
          addFromResponse(await legacyRes.json());
        }
      }

      setAssets(chips);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [taskId, taskIndex, projectId]);

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
      onAssetsChanged?.();
    } else {
      alert(result.error ?? 'Could not delete asset.');
    }
    setDeletingAsset(false);
  };

  if (!canViewAssets) return null;

  const chipClass =
    'relative group inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium text-primary max-w-[220px]';

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
      <div className={lightSurface('mt-2 pt-2 border-t border-gray-100', 'dark:border-gray-700', light)}>
        {!taskId ? (
          <p className="text-xs text-gray-500 mt-1">Save the task to attach assets.</p>
        ) : (
          <>
            {canAddAssets && (
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <AddButton
                  projectId={projectId}
                  label="Add"
                  linkContext={{
                    linkedProjectId: projectId,
                    linkedProjectTaskId: taskId,
                    linkedProjectTaskIndex: taskIndex,
                  }}
                  onDocumentCreated={() => {
                    void loadAssets();
                    onAssetsChanged?.();
                  }}
                  onAddButton={async () => {}}
                />
              </div>
            )}
            {loading && <p className="text-xs text-text-secondary">Loading assets…</p>}
            {!loading && assets.length === 0 && showAddHintText && (
              <p className="text-xs text-text-secondary">
                No assets linked yet.
                {canAddAssets ? ' Use Add to attach files or documents.' : ''}
              </p>
            )}
            {!loading && assets.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">{assets.map(renderAssetChip)}</div>
            )}
            {taskId && (
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <LinkedRecordingChips
                  projectId={projectId}
                  taskId={taskId}
                  refreshToken={refreshToken}
                  chipClassName={chipClass}
                />
              </div>
            )}
          </>
        )}
      </div>

      <ImagePreviewModal
        isOpen={previewImage !== null}
        onClose={() => setPreviewImage(null)}
        src={previewImage?.src ?? null}
        title={previewImage?.title}
      />
      <LinkedAssetDocumentSheet
        asset={previewDocument}
        isOpen={previewDocument !== null}
        onClose={() => setPreviewDocument(null)}
        projectId={projectId}
        onSaved={(updated) => {
          setAssets((prev) =>
            prev.map((a) => (a._id === previewDocument?._id ? { ...a, name: updated.name } : a))
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
      />
    </>
  );
}
