'use client';

import type { ReactNode } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  elevated?: boolean;
  stackAboveOverlays?: boolean;
  stackAboveLightbox?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  loading = false,
  onCancel,
  onConfirm,
  elevated = false,
  stackAboveOverlays = false,
  stackAboveLightbox = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onCancel}
      title={title}
      maxWidth="sm"
      elevated={elevated}
      stackAboveOverlays={stackAboveOverlays}
      stackAboveLightbox={stackAboveLightbox}
    >
      <div className="space-y-4">
        <div className="text-sm text-gray-600">{message}</div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant === 'danger' ? 'danger' : undefined}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? `${confirmLabel}…` : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
