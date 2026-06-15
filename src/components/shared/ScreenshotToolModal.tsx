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
  uploadOnly?: boolean;
}

export default function ScreenshotToolModal({
  isOpen,
  onClose,
  target = null,
  projects = [],
  uploadOnly = false,
}: ScreenshotToolModalProps) {
  const allowAssignment = !target;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={uploadOnly ? 'Upload image' : 'Screenshot'} maxWidth="md">
      <ScreenshotToolPanel
        target={target}
        projects={projects}
        allowAssignment={allowAssignment}
        uploadOnly={uploadOnly}
        onUploaded={onClose}
        description="Capture the full window or drag to select an area. Save to Nucleas with optional project/task links, or download locally."
      />
    </Modal>
  );
}
