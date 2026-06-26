'use client';

import Modal from '@/components/ui/Modal';
import RecordingToolPanel from '@/components/shared/RecordingToolPanel';
import { getRecordingCaptureMode } from '@/lib/capture/mobileCapture';
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

function recordingModalTitle(uploadOnly: boolean): string {
  if (uploadOnly) return 'Upload video';
  const mode = getRecordingCaptureMode();
  if (mode === 'camera') return 'Record video';
  return 'Record';
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
  const captureMode = getRecordingCaptureMode();
  const effectiveUploadOnly = uploadOnly || captureMode === 'upload-only';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={recordingModalTitle(effectiveUploadOnly)}
      maxWidth="md"
    >
      <RecordingToolPanel
        target={target}
        projects={projects}
        allowAssignment={allowAssignment}
        uploadOnly={uploadOnly}
        onUploaded={onClose}
        onPrepared={onClose}
        recordingControl={recordingControl}
        hideSaveDialog={!!recordingControl}
        description={
          captureMode === 'camera'
            ? 'Record a video with your camera or upload an existing file. Save to Nucleas with optional project/task links, or download locally as MP4.'
            : 'Choose an audio source, then record your screen. Save to Nucleas with optional project/task links, or download locally as MP4.'
        }
      />
    </Modal>
  );
}
