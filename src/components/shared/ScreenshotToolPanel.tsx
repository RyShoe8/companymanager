'use client';

import { useRef } from 'react';
import Button from '@/components/ui/Button';
import ScreenshotNameDialog from '@/components/shared/ScreenshotNameDialog';
import ScreenshotSaveDialog from '@/components/shared/ScreenshotSaveDialog';
import ImagePreviewModal from '@/components/shared/ImagePreviewModal';
import { isScreenshotCaptureSupported } from '@/lib/captureScreenshot';
import { useScreenshotUpload } from '@/hooks/useScreenshotUpload';
import type { IProject } from '@/lib/models/Project';
import type { ScreenshotUploadTarget } from '@/lib/uploadScreenshotAsset';

interface ScreenshotToolPanelProps {
  target?: ScreenshotUploadTarget | null;
  projects?: IProject[];
  allowAssignment?: boolean;
  description?: string;
  onUploaded?: () => void;
  onBack?: () => void;
  showBack?: boolean;
}

export default function ScreenshotToolPanel({
  target = null,
  projects = [],
  allowAssignment = false,
  description = 'Capture a screen or upload an image to save as an asset.',
  onUploaded,
  onBack,
  showBack = false,
}: ScreenshotToolPanelProps) {
  const screenshotFileInputRef = useRef<HTMLInputElement>(null);
  const screenshotCaptureSupported = isScreenshotCaptureSupported();
  const useSaveDialog = allowAssignment && !target;

  const {
    status,
    statusMessage: screenshotStatusMessage,
    errorMessage: screenshotErrorMessage,
    isBusy: screenshotBusy,
    isNaming: screenshotNaming,
    suggestedName: screenshotSuggestedName,
    previewUrl: screenshotPreviewUrl,
    uploadFromFiles: screenshotUploadFromFiles,
    captureAndUpload: screenshotCaptureAndUpload,
    confirmName: screenshotConfirmName,
    downloadByName: screenshotDownloadByName,
    cancelNaming: screenshotCancelNaming,
  } = useScreenshotUpload(target, onUploaded);

  return (
    <>
      <div className="space-y-3">
        <p className="text-sm text-text-secondary">{description}</p>
        <input
          ref={screenshotFileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={screenshotBusy}
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = '';
            if (files.length > 0) {
              screenshotUploadFromFiles(files);
            }
          }}
        />
        <div className="flex flex-col gap-2">
          {screenshotCaptureSupported && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (!screenshotBusy) void screenshotCaptureAndUpload();
              }}
              disabled={screenshotBusy}
            >
              {screenshotBusy && screenshotStatusMessage?.startsWith('Capturing')
                ? screenshotStatusMessage
                : 'Take screenshot'}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!screenshotBusy) screenshotFileInputRef.current?.click();
            }}
            disabled={screenshotBusy}
          >
            {screenshotBusy && screenshotStatusMessage?.startsWith('Uploading')
              ? screenshotStatusMessage
              : 'Upload file'}
          </Button>
        </div>
        {screenshotStatusMessage && !screenshotBusy && (
          <p className="text-xs text-text-muted">{screenshotStatusMessage}</p>
        )}
        {screenshotErrorMessage && (
          <p className="text-xs text-error">{screenshotErrorMessage}</p>
        )}
        {!screenshotCaptureSupported && !screenshotErrorMessage && (
          <p className="text-xs text-text-muted">
            Screenshot capture is unavailable on this device. Please upload an image instead.
          </p>
        )}
        {showBack && onBack && (
          <Button type="button" variant="secondary" size="sm" onClick={onBack} disabled={screenshotBusy}>
            Back
          </Button>
        )}
      </div>

      {screenshotNaming && screenshotPreviewUrl && !useSaveDialog && (
        <ImagePreviewModal
          mode="naming"
          isOpen
          onClose={() => {}}
          src={screenshotPreviewUrl}
          title="Screenshot preview"
        />
      )}
      {useSaveDialog ? (
        <ScreenshotSaveDialog
          isOpen={screenshotNaming}
          defaultName={screenshotSuggestedName}
          previewUrl={screenshotPreviewUrl}
          projects={projects}
          saving={status === 'uploading'}
          onSave={(name, uploadTarget) => void screenshotConfirmName(name, uploadTarget)}
          onDownload={screenshotDownloadByName}
          onCancel={screenshotCancelNaming}
        />
      ) : (
        <ScreenshotNameDialog
          isOpen={screenshotNaming}
          defaultName={screenshotSuggestedName}
          onConfirm={(name) => void screenshotConfirmName(name)}
          onCancel={screenshotCancelNaming}
        />
      )}
    </>
  );
}
