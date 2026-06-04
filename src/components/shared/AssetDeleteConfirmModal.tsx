'use client';

import ConfirmModal from '@/components/shared/ConfirmModal';

interface AssetDeleteConfirmModalProps {
  isOpen: boolean;
  assetName: string;
  assetTypeLabel?: string;
  deleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  stackAboveLightbox?: boolean;
}

export default function AssetDeleteConfirmModal({
  isOpen,
  assetName,
  assetTypeLabel,
  deleting = false,
  onCancel,
  onConfirm,
  stackAboveLightbox = false,
}: AssetDeleteConfirmModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      title="Delete asset?"
      message={
        <>
          <p>
            Are you sure you want to delete{' '}
            <strong className="text-gray-900">{assetName}</strong>
            {assetTypeLabel ? <> ({assetTypeLabel})</> : null}?
          </p>
          <p className="mt-3 text-gray-500">
            This removes the asset for your organization everywhere it appears—not only from this
            project.
          </p>
        </>
      }
      confirmLabel={deleting ? 'Deleting' : 'Delete'}
      loading={deleting}
      onCancel={onCancel}
      onConfirm={onConfirm}
      elevated
      stackAboveOverlays={!stackAboveLightbox}
      stackAboveLightbox={stackAboveLightbox}
    />
  );
}
