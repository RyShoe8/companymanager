'use client';

import { useRef } from 'react';
import Button from '@/components/ui/Button';
import Dropdown from '@/components/ui/Dropdown';
import ScreenshotNameDialog from '@/components/shared/ScreenshotNameDialog';
import { isScreenshotCaptureSupported } from '@/lib/captureScreenshot';
import { useScreenshotUpload } from '@/hooks/useScreenshotUpload';
import type { ScreenshotUploadTarget } from '@/lib/uploadScreenshotAsset';

interface ScreenshotButtonProps extends ScreenshotUploadTarget {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  onUploaded?: () => void;
}

export default function ScreenshotButton({
  entityType,
  entityId,
  taskId,
  taskIndex,
  className = 'h-[38px] min-h-0 whitespace-nowrap flex-shrink-0',
  size = 'sm',
  onUploaded,
}: ScreenshotButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureSupported = isScreenshotCaptureSupported();

  const target: ScreenshotUploadTarget = {
    entityType,
    entityId,
    taskId,
    taskIndex,
  };

  const {
    statusMessage,
    errorMessage,
    isBusy,
    isNaming,
    suggestedName,
    uploadFromFiles,
    captureAndUpload,
    confirmName,
    cancelNaming,
  } = useScreenshotUpload(target, onUploaded);

  const triggerLabel =
    statusMessage ??
    (isBusy ? 'Working...' : 'Add screenshot');

  const menuItems = [
    {
      label: 'Upload file',
      onClick: () => {
        if (isBusy) return;
        fileInputRef.current?.click();
      },
    },
    ...(captureSupported
      ? [
          {
            label: 'Take screenshot',
            onClick: () => {
              if (isBusy) return;
              void captureAndUpload();
            },
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col items-start gap-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={isBusy}
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = '';
          if (files.length > 0) {
            uploadFromFiles(files);
          }
        }}
      />

      {menuItems.length === 1 ? (
        <Button
          type="button"
          variant="secondary"
          size={size}
          disabled={isBusy}
          onClick={() => fileInputRef.current?.click()}
          className={className}
        >
          {triggerLabel}
        </Button>
      ) : (
        <Dropdown
          align="right"
          trigger={
            <span
              className={`inline-flex items-center justify-center font-medium rounded-lg transition-colors px-3 py-1.5 text-sm bg-secondary-light text-secondary border border-secondary/20 ${
                isBusy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-secondary-light/80'
              } ${className}`}
            >
              {triggerLabel}
            </span>
          }
          items={menuItems}
        />
      )}

      <ScreenshotNameDialog
        isOpen={isNaming}
        defaultName={suggestedName}
        onConfirm={(name) => void confirmName(name)}
        onCancel={cancelNaming}
      />

      {errorMessage && (
        <p className="text-xs text-red-600 dark:text-red-400 max-w-xs">{errorMessage}</p>
      )}
      {!captureSupported && !errorMessage && (
        <p className="text-xs text-text-secondary max-w-xs">
          Screenshot capture is unavailable on this device. Please upload an image instead.
        </p>
      )}
    </div>
  );
}
