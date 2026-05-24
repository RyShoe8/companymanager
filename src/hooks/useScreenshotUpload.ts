'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { captureScreenshot, ScreenshotCaptureError } from '@/lib/captureScreenshot';
import { compressImageFile } from '@/lib/compressImageFile';
import {
  uploadScreenshotAsset,
  type ScreenshotUploadTarget,
} from '@/lib/uploadScreenshotAsset';

export type ScreenshotUploadStatus = 'idle' | 'capturing' | 'uploading' | 'success' | 'error';

export function useScreenshotUpload(
  target: ScreenshotUploadTarget,
  onUploaded?: () => void
) {
  const [status, setStatus] = useState<ScreenshotUploadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const successTimerRef = useRef<number | null>(null);

  const clearSuccessTimer = useCallback(() => {
    if (successTimerRef.current != null) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearSuccessTimer(), [clearSuccessTimer]);

  const reset = useCallback(() => {
    clearSuccessTimer();
    setStatus('idle');
    setStatusMessage(null);
    setErrorMessage(null);
  }, [clearSuccessTimer]);

  const uploadCompressedFiles = useCallback(
    async (files: File[]) => {
      setStatus('uploading');
      setStatusMessage('Uploading screenshot...');
      setErrorMessage(null);

      try {
        for (const file of files) {
          const compressed = await compressImageFile(file);
          await uploadScreenshotAsset(compressed, target);
        }

        setStatus('success');
        setStatusMessage('✓ Screenshot attached');
        onUploaded?.();

        clearSuccessTimer();
        successTimerRef.current = window.setTimeout(() => {
          reset();
        }, 2000);
      } catch (error) {
        setStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to upload screenshot.'
        );
        setStatusMessage(null);
      }
    },
    [target, onUploaded, reset, clearSuccessTimer]
  );

  const uploadFromFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      await uploadCompressedFiles(files);
    },
    [uploadCompressedFiles]
  );

  const captureAndUpload = useCallback(async () => {
    setStatus('capturing');
    setStatusMessage('Capturing screenshot...');
    setErrorMessage(null);

    try {
      const captured = await captureScreenshot();
      await uploadCompressedFiles([captured]);
    } catch (error) {
      if (error instanceof ScreenshotCaptureError && error.code === 'canceled') {
        reset();
        return;
      }

      setStatus('error');
      setErrorMessage(
        error instanceof ScreenshotCaptureError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to capture screenshot.'
      );
      setStatusMessage(null);
    }
  }, [uploadCompressedFiles, reset]);

  const isBusy = status === 'capturing' || status === 'uploading';

  return {
    status,
    statusMessage,
    errorMessage,
    isBusy,
    uploadFromFiles,
    captureAndUpload,
    reset,
  };
}
