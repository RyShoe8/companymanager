'use client';

import { useRef } from 'react';
import Button from '@/components/ui/Button';
import RecordingSaveDialog from '@/components/shared/RecordingSaveDialog';
import RecordingNameDialog from '@/components/shared/RecordingNameDialog';
import RecordingOverlay from '@/components/shared/RecordingOverlay';
import { isRecordingCaptureSupported } from '@/lib/captureRecording';
import { useRecordingUpload } from '@/hooks/useRecordingUpload';
import type { IProject } from '@/lib/models/Project';
import type { MediaUploadTarget } from '@/lib/mediaUploadTarget';

interface RecordingToolPanelProps {
  target?: MediaUploadTarget | null;
  projects?: IProject[];
  allowAssignment?: boolean;
  uploadOnly?: boolean;
  description?: string;
  onUploaded?: () => void;
  onBack?: () => void;
  showBack?: boolean;
}

export default function RecordingToolPanel({
  target = null,
  projects = [],
  allowAssignment = false,
  uploadOnly = false,
  description = 'Record your screen and microphone, or upload a video.',
  onUploaded,
  onBack,
  showBack = false,
}: RecordingToolPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureSupported = isRecordingCaptureSupported();
  const useSaveDialog = allowAssignment && !target;

  const {
    status,
    statusMessage,
    errorMessage,
    micWarning,
    isBusy,
    isRecording,
    isNaming,
    controlsInPopout,
    suggestedName,
    previewUrl,
    elapsedLabel,
    startRecording,
    stopRecording,
    uploadFromFiles,
    confirmSave,
    downloadByName,
    cancelNaming,
  } = useRecordingUpload(target, onUploaded);

  return (
    <>
      {isRecording && !controlsInPopout && (
        <RecordingOverlay elapsedLabel={elapsedLabel} onStop={() => void stopRecording()} />
      )}

      <div className="space-y-3">
        {!uploadOnly && <p className="text-sm text-text-secondary">{description}</p>}
        {uploadOnly && (
          <p className="text-sm text-text-secondary">
            Recording capture is unavailable on this device. Upload a video instead.
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          disabled={isBusy}
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = '';
            if (files.length > 0) void uploadFromFiles(files);
          }}
        />
        <div className="flex flex-col gap-2">
          {captureSupported && !uploadOnly && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (!isBusy) void startRecording();
              }}
              disabled={isBusy}
            >
              {isRecording ? 'Recording…' : 'Start recording'}
            </Button>
          )}
          <Button
            type="button"
            variant={uploadOnly ? undefined : 'secondary'}
            size="sm"
            onClick={() => {
              if (!isBusy) fileInputRef.current?.click();
            }}
            disabled={isBusy}
          >
            Upload video
          </Button>
        </div>
        {statusMessage && !isBusy && (
          <p className="text-xs text-text-muted">{statusMessage}</p>
        )}
        {errorMessage && <p className="text-xs text-error">{errorMessage}</p>}
        {showBack && onBack && (
          <Button type="button" variant="secondary" size="sm" onClick={onBack} disabled={isBusy}>
            Back
          </Button>
        )}
      </div>

      {useSaveDialog ? (
        <RecordingSaveDialog
          isOpen={isNaming}
          defaultName={suggestedName}
          previewUrl={previewUrl}
          projects={projects}
          micWarning={micWarning}
          saving={status === 'uploading'}
          processing={status === 'processing'}
          statusMessage={statusMessage}
          onSave={(name, uploadTarget) => void confirmSave(name, uploadTarget)}
          onDownload={downloadByName}
          onCancel={cancelNaming}
        />
      ) : (
        <RecordingNameDialog
          isOpen={isNaming}
          defaultName={suggestedName}
          saving={status === 'uploading'}
          processing={status === 'processing'}
          onConfirm={(name) => void confirmSave(name)}
          onCancel={cancelNaming}
        />
      )}
    </>
  );
}
