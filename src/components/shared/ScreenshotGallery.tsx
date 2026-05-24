'use client';

import { useState, useEffect } from 'react';
import { IAsset } from '@/lib/models/Asset';
import ImagePreviewModal from '@/components/shared/ImagePreviewModal';
import HoverDeleteButton from '@/components/shared/HoverDeleteButton';
import AssetDeleteConfirmModal from '@/components/shared/AssetDeleteConfirmModal';
import { deleteLinkedAsset, canUserDeleteAsset } from '@/lib/utils/linkedAssets';
import { screenshotAssetsUrl } from '@/lib/utils/screenshotAssets';

interface ScreenshotGalleryProps {
  entityType: 'project' | 'projectTask' | 'contentItem';
  entityId: string;
  taskId?: string;
  taskIndex?: number;
  isManagerOrAdmin?: boolean;
  currentUserId?: string;
  compact?: boolean;
  refreshToken?: number;
}

export default function ScreenshotGallery({
  entityType,
  entityId,
  taskId,
  taskIndex,
  isManagerOrAdmin = false,
  currentUserId: currentUserIdProp,
  compact = false,
  refreshToken = 0,
}: ScreenshotGalleryProps) {
  const [screenshots, setScreenshots] = useState<IAsset[]>([]);
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);
  const [assetPendingDelete, setAssetPendingDelete] = useState<IAsset | null>(null);
  const [deletingAsset, setDeletingAsset] = useState(false);
  const [fetchedUserId, setFetchedUserId] = useState<string | undefined>();
  const currentUserId = currentUserIdProp ?? fetchedUserId;

  useEffect(() => {
    if (currentUserIdProp == null) {
      fetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data?.id && setFetchedUserId(data.id))
        .catch(() => {});
    }
  }, [currentUserIdProp]);

  const loadScreenshots = async () => {
    try {
      const url = screenshotAssetsUrl({ entityType, entityId, taskId, taskIndex });
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setScreenshots(Array.isArray(data) ? data : []);
      }
    } catch {
      // Error loading screenshots
    }
  };

  useEffect(() => {
    void loadScreenshots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId, taskId, taskIndex, refreshToken]);

  const confirmDeleteScreenshot = async () => {
    if (!assetPendingDelete) return;
    setDeletingAsset(true);
    const result = await deleteLinkedAsset(assetPendingDelete._id.toString());
    if (result.ok) {
      setAssetPendingDelete(null);
      if (previewImage && assetPendingDelete.fileUrl === previewImage.src) {
        setPreviewImage(null);
      }
      await loadScreenshots();
    } else {
      alert(result.error ?? 'Could not delete asset.');
    }
    setDeletingAsset(false);
  };

  if (screenshots.length === 0) return null;

  if (compact) {
    return (
      <>
        <div className="flex flex-wrap items-center gap-1.5">
          {screenshots.map((screenshot) => (
            <div key={screenshot._id.toString()} className="relative group shrink-0">
              <button
                type="button"
                className="w-14 h-10 rounded border border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-90 transition-opacity overflow-hidden bg-gray-100 dark:bg-gray-800"
                onClick={() =>
                  screenshot.fileUrl && setPreviewImage({ src: screenshot.fileUrl, title: screenshot.name })
                }
                title={screenshot.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshot.fileUrl}
                  alt={screenshot.name}
                  className="w-full h-full object-contain"
                />
              </button>
              {canUserDeleteAsset(screenshot.userId, currentUserId, isManagerOrAdmin) && (
                <HoverDeleteButton
                  label={`Delete ${screenshot.name}`}
                  onClick={() => setAssetPendingDelete(screenshot)}
                />
              )}
            </div>
          ))}
        </div>
        <ImagePreviewModal
          isOpen={previewImage !== null}
          onClose={() => setPreviewImage(null)}
          src={previewImage?.src ?? null}
          title={previewImage?.title}
        />
        <AssetDeleteConfirmModal
          isOpen={assetPendingDelete !== null}
          assetName={assetPendingDelete?.name ?? ''}
          assetTypeLabel="screenshot"
          deleting={deletingAsset}
          onCancel={() => {
            if (!deletingAsset) setAssetPendingDelete(null);
          }}
          onConfirm={() => void confirmDeleteScreenshot()}
        />
      </>
    );
  }

  return (
    <>
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">Screenshots</label>
        <div className="grid grid-cols-4 gap-2">
          {screenshots.map((screenshot) => (
            <div key={screenshot._id.toString()} className="relative group">
              <button
                type="button"
                className="w-full aspect-[4/3] rounded border border-gray-200 dark:border-gray-700 cursor-pointer hover:opacity-90 transition-opacity overflow-hidden bg-gray-100 dark:bg-gray-800"
                onClick={() =>
                  screenshot.fileUrl && setPreviewImage({ src: screenshot.fileUrl, title: screenshot.name })
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshot.fileUrl}
                  alt={screenshot.name}
                  className="w-full h-full object-contain"
                />
              </button>
              {canUserDeleteAsset(screenshot.userId, currentUserId, isManagerOrAdmin) && (
                <HoverDeleteButton
                  label={`Delete ${screenshot.name}`}
                  onClick={() => setAssetPendingDelete(screenshot)}
                />
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate" title={screenshot.name}>
                {screenshot.name}
              </p>
            </div>
          ))}
        </div>
      </div>
      <ImagePreviewModal
        isOpen={previewImage !== null}
        onClose={() => setPreviewImage(null)}
        src={previewImage?.src ?? null}
        title={previewImage?.title}
      />
      <AssetDeleteConfirmModal
        isOpen={assetPendingDelete !== null}
        assetName={assetPendingDelete?.name ?? ''}
        assetTypeLabel="screenshot"
        deleting={deletingAsset}
        onCancel={() => {
          if (!deletingAsset) setAssetPendingDelete(null);
        }}
        onConfirm={() => void confirmDeleteScreenshot()}
      />
    </>
  );
}
