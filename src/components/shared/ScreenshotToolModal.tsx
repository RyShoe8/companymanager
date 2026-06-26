'use client';

import Modal from '@/components/ui/Modal';
import ScreenshotToolPanel from '@/components/shared/ScreenshotToolPanel';
import { getScreenshotCaptureMode } from '@/lib/capture/mobileCapture';
import type { IProject } from '@/lib/models/Project';
import type { ScreenshotUploadTarget } from '@/lib/uploadScreenshotAsset';

interface ScreenshotToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  target?: ScreenshotUploadTarget | null;
  projects?: IProject[];
  uploadOnly?: boolean;
}

function screenshotModalTitle(uploadOnly: boolean): string {
  if (uploadOnly) return 'Upload image';
  const mode = getScreenshotCaptureMode();
  if (mode === 'camera') return 'Photo';
  return 'Screenshot';
}

export default function ScreenshotToolModal({
  isOpen,
  onClose,
  target = null,
  projects = [],
  uploadOnly = false,
}: ScreenshotToolModalProps) {
  const allowAssignment = !target;
  const effectiveUploadOnly = uploadOnly || getScreenshotCaptureMode() === 'upload-only';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={screenshotModalTitle(effectiveUploadOnly)}
      maxWidth="md"
    >
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
