'use client';

import Modal from '@/components/ui/Modal';
import RecordingToolPanel from '@/components/shared/RecordingToolPanel';
import type { IProject } from '@/lib/models/Project';
import type { MediaUploadTarget } from '@/lib/mediaUploadTarget';
import type { RecordingUploadControl } from '@/hooks/useRecordingUpload';

interface RecordingToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  target?: MediaUploadTarget | null;
  projects?: IProject[];
  uploadOnly?: boolean;
  recordingControl?: RecordingUploadControl;
}

export default function RecordingToolModal({
  isOpen,
  onClose,
  target = null,
  projects = [],
  uploadOnly = false,
  recordingControl,
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
        recordingControl={recordingControl}
        hideSaveDialog={!!recordingControl}
        description="Choose an audio source, then record your screen. Save to Nucleas with optional project/task links, or download locally as MP4."
      />
    </Modal>
  );
}
