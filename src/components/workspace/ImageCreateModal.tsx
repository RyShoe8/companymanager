'use client';

import Modal from '@/components/ui/Modal';

interface ImageCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScreenshot: () => void;
}

export default function ImageCreateModal({
  isOpen,
  onClose,
  onScreenshot,
}: ImageCreateModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create image" maxWidth="sm">
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">Choose how you want to add an image.</p>
        <button
          type="button"
          onClick={() => {
            onClose();
            onScreenshot();
          }}
          className="w-full text-left rounded-lg border border-border bg-background-card p-4 hover:bg-muted/40 transition-colors"
        >
          <div className="font-medium text-text-primary">Screenshot</div>
          <p className="text-sm text-text-secondary mt-1">
            Capture your screen or upload an image file
          </p>
        </button>
      </div>
    </Modal>
  );
}
