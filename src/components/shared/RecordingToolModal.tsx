'use client';

import Modal from '@/components/ui/Modal';
import RecordingToolPanel from '@/components/shared/RecordingToolPanel';
import type { IProject } from '@/lib/models/Project';
import type { MediaUploadTarget } from '@/lib/mediaUploadTarget';

interface RecordingToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  target?: MediaUploadTarget | null;
  projects?: IProject[];
  uploadOnly?: boolean;
}

export default function RecordingToolModal({
  isOpen,
  onClose,
  target = null,
  projects = [],
  uploadOnly = false,
}: RecordingToolModalProps) {
  const allowAssignment = !target;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={uploadOnly ? 'Upload video' : 'Record'}
      maxWidth="md"
    >
      <RecordingToolPanel
        target={target}
        projects={projects}
        allowAssignment={allowAssignment}
        uploadOnly={uploadOnly}
        onUploaded={onClose}
        description="Record your screen and microphone, or upload a video. Save to Nucleas with optional project/task links, or download locally."
      />
    </Modal>
  );
}
