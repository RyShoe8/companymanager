'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

interface AssetDeleteConfirmModalProps {
  isOpen: boolean;
  assetName: string;
  assetTypeLabel?: string;
  deleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function AssetDeleteConfirmModal({
  isOpen,
  assetName,
  assetTypeLabel,
  deleting = false,
  onCancel,
  onConfirm,
}: AssetDeleteConfirmModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <Modal isOpen={isOpen} onClose={onCancel} title="Delete asset?" maxWidth="sm" elevated stackAboveOverlays>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Are you sure you want to delete{' '}
          <strong className="text-gray-900 dark:text-white">{assetName}</strong>
          {assetTypeLabel ? <> ({assetTypeLabel})</> : null}?
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This removes the asset for your organization everywhere it appears—not only from this project.
        </p>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>
    </Modal>,
    document.body
  );
}
