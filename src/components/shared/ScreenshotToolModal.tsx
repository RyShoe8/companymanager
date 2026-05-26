'use client';

import Modal from '@/components/ui/Modal';
import ScreenshotToolPanel from '@/components/shared/ScreenshotToolPanel';
import type { ScreenshotUploadTarget } from '@/lib/uploadScreenshotAsset';

interface ScreenshotToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  target?: ScreenshotUploadTarget | null;
}

export default function ScreenshotToolModal({
  isOpen,
  onClose,
  target = null,
}: ScreenshotToolModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Screenshot" maxWidth="md">
      <ScreenshotToolPanel
        target={target}
        onUploaded={onClose}
        description="Capture your screen or upload an image. It will be saved to your asset library."
      />
    </Modal>
  );
}
