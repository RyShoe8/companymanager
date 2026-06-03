'use client';

import Modal from '@/components/ui/Modal';
import ScreenshotToolPanel from '@/components/shared/ScreenshotToolPanel';
import type { IProject } from '@/lib/models/Project';
import type { ScreenshotUploadTarget } from '@/lib/uploadScreenshotAsset';

interface ScreenshotToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  target?: ScreenshotUploadTarget | null;
  projects?: IProject[];
}

export default function ScreenshotToolModal({
  isOpen,
  onClose,
  target = null,
  projects = [],
}: ScreenshotToolModalProps) {
  const allowAssignment = !target;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Screenshot" maxWidth="md">
      <ScreenshotToolPanel
        target={target}
        projects={projects}
        allowAssignment={allowAssignment}
        onUploaded={onClose}
        description="Capture your screen or upload an image. Save to Nucleas with optional project/task links, or download locally."
      />
    </Modal>
  );
}
