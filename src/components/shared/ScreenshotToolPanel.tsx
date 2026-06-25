'use client';

import { useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import ScreenshotNameDialog from '@/components/shared/ScreenshotNameDialog';
import ScreenshotSaveDialog from '@/components/shared/ScreenshotSaveDialog';
import ScreenshotRegionSelector from '@/components/shared/ScreenshotRegionSelector';
import ImagePreviewModal from '@/components/shared/ImagePreviewModal';
import { isScreenshotCaptureSupported } from '@/lib/captureScreenshot';
import { useScreenshotUpload } from '@/hooks/useScreenshotUpload';
import type { IProject } from '@/lib/models/Project';
import type { ScreenshotUploadTarget } from '@/lib/uploadScreenshotAsset';

interface ScreenshotToolPanelProps {
  target?: ScreenshotUploadTarget | null;
  projects?: IProject[];
  allowAssignment?: boolean;
  uploadOnly?: boolean;
  downloadOnly?: boolean;
  description?: string;
  onUploaded?: (asset?: unknown) => void;
  onBack?: () => void;
  showBack?: boolean;
}

export default function ScreenshotToolPanel({
  target = null,
  projects = [],
  allowAssignment = false,
  uploadOnly = false,
  downloadOnly = false,
  description = downloadOnly
    ? 'Choose how to capture, then pick a tab or window in your browser’s share dialog.'
    : 'Capture a screen or upload an image to save as an asset.',
  onUploaded,
  onBack,
  showBack = false,
}: ScreenshotToolPanelProps) {
  const screenshotFileInputRef = useRef<HTMLInputElement>(null);
  const screenshotCaptureSupported = isScreenshotCaptureSupported();
  const useSaveDialog = allowAssignment && !target && !downloadOnly;
  const showFileUpload = !downloadOnly;

  const {
    status,
    statusMessage: screenshotStatusMessage,
    errorMessage: screenshotErrorMessage,
    isBusy: screenshotBusy,
    isSelectingRegion,
    isNaming: screenshotNaming,
    suggestedName: screenshotSuggestedName,
    previewUrl: screenshotPreviewUrl,
    regionPreviewUrl,
    uploadFromFiles: screenshotUploadFromFiles,
    startCapture,
    confirmRegion,
    cancelRegionSelection,
    confirmName: screenshotConfirmName,
    downloadByName: screenshotDownloadByName,
    cancelNaming: screenshotCancelNaming,
    captureFromUrl,
  } = useScreenshotUpload(target, onUploaded);

  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  const controlsDisabled = screenshotBusy || isSelectingRegion;

  return (
    <>
      <div className="space-y-3">
        {!uploadOnly && <p className="text-sm text-text-secondary">{description}</p>}
        {uploadOnly && (
          <p className="text-sm text-text-secondary">
            Screenshot capture is unavailable on this device. Upload an image instead.
          </p>
        )}
        {showFileUpload && (
          <input
            ref={screenshotFileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={controlsDisabled}
            onChange={(e) => {
              const files = e.target.files ? Array.from(e.target.files) : [];
              e.target.value = '';
              if (files.length > 0) {
                screenshotUploadFromFiles(files);
              }
            }}
          />
        )}
        <div className="flex flex-col gap-2">
          {screenshotCaptureSupported && !uploadOnly && (
            <>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (!controlsDisabled) void startCapture('full');
                }}
                disabled={controlsDisabled}
              >
                {screenshotBusy && screenshotStatusMessage?.startsWith('Capturing')
                  ? screenshotStatusMessage
                  : 'Capture full window'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (!controlsDisabled) void startCapture('region');
                }}
                disabled={controlsDisabled}
              >
                Select area
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (!controlsDisabled) setShowUrlInput(!showUrlInput);
                }}
                disabled={controlsDisabled}
              >
                Capture full page from URL
              </Button>
            </>
          )}

          {showUrlInput && (
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://example.com"
                className="flex-1 bg-background-elevated border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && urlInput.trim()) {
                    e.preventDefault();
                    void captureFromUrl(urlInput.trim());
                    setShowUrlInput(false);
                    setUrlInput('');
                  }
                }}
                disabled={controlsDisabled}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (urlInput.trim()) {
                    void captureFromUrl(urlInput.trim());
                    setShowUrlInput(false);
                    setUrlInput('');
                  }
                }}
                disabled={controlsDisabled || !urlInput.trim()}
              >
                Capture
              </Button>
            </div>
          )}

          {showFileUpload && (
            <Button
              type="button"
              variant={uploadOnly ? undefined : 'secondary'}
              size="sm"
              onClick={() => {
                if (!controlsDisabled) screenshotFileInputRef.current?.click();
              }}
              disabled={controlsDisabled}
            >
              {screenshotBusy && screenshotStatusMessage?.startsWith('Uploading')
                ? screenshotStatusMessage
                : 'Upload file'}
            </Button>
          )}
        </div>
        {screenshotStatusMessage && !screenshotBusy && (
          <p className="text-xs text-text-muted">{screenshotStatusMessage}</p>
        )}
        {screenshotErrorMessage && (
          <p className="text-xs text-error">{screenshotErrorMessage}</p>
        )}
        {!uploadOnly && !screenshotCaptureSupported && !screenshotErrorMessage && (
          <p className="text-xs text-text-muted">
            {downloadOnly
              ? 'Screenshot capture is unavailable in this browser. Try Chrome or Edge on desktop.'
              : 'Screenshot capture is unavailable on this device. Please upload an image instead.'}
          </p>
        )}
        {showBack && onBack && (
          <Button type="button" variant="secondary" size="sm" onClick={onBack} disabled={controlsDisabled}>
            Back
          </Button>
        )}
      </div>

      {isSelectingRegion && regionPreviewUrl && (
        <ScreenshotRegionSelector
          imageUrl={regionPreviewUrl}
          onConfirm={(rect) => void confirmRegion(rect)}
          onCancel={cancelRegionSelection}
        />
      )}

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
          submitLabel={downloadOnly ? 'Download' : 'Upload'}
          onConfirm={(name) =>
            void (downloadOnly ? screenshotDownloadByName(name) : screenshotConfirmName(name))
          }
          onCancel={screenshotCancelNaming}
        />
      )}
    </>
  );
}
