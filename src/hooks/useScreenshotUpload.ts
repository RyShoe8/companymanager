'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { captureScreenshot, ScreenshotCaptureError } from '@/lib/captureScreenshot';
import { compressImageFile } from '@/lib/compressImageFile';
import { downloadImage } from '@/lib/downloadImage';
import {
  uploadScreenshotAsset,
  type ScreenshotUploadTarget,
} from '@/lib/uploadScreenshotAsset';

export type ScreenshotUploadStatus = 'idle' | 'capturing' | 'naming' | 'uploading' | 'success' | 'error';

export function defaultScreenshotName(): string {
  const d = new Date();
  return `Screenshot ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export function useScreenshotUpload(
  target: ScreenshotUploadTarget | null,
  onUploaded?: () => void
) {
  const [status, setStatus] = useState<ScreenshotUploadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [suggestedName, setSuggestedName] = useState(defaultScreenshotName);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const successTimerRef = useRef<number | null>(null);

  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const clearSuccessTimer = useCallback(() => {
    if (successTimerRef.current != null) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    clearSuccessTimer();
    revokePreviewUrl();
  }, [clearSuccessTimer, revokePreviewUrl]);

  const reset = useCallback(() => {
    clearSuccessTimer();
    revokePreviewUrl();
    setStatus('idle');
    setStatusMessage(null);
    setErrorMessage(null);
    setPendingFiles([]);
  }, [clearSuccessTimer, revokePreviewUrl]);

  const uploadCompressedFiles = useCallback(
    async (files: File[], name: string, uploadTarget?: ScreenshotUploadTarget | null) => {
      setStatus('uploading');
      setStatusMessage('Uploading screenshot...');
      setErrorMessage(null);

      const resolvedTarget = uploadTarget !== undefined ? uploadTarget : target;

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const compressed = await compressImageFile(file);
          const assetName = files.length > 1 ? `${name} (${i + 1})` : name;
          await uploadScreenshotAsset(compressed, resolvedTarget, { name: assetName });
        }

        setStatus('success');
        setStatusMessage('✓ Screenshot attached');
        setPendingFiles([]);
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
        setPendingFiles([]);
      } finally {
        revokePreviewUrl();
      }
    },
    [target, onUploaded, reset, clearSuccessTimer, revokePreviewUrl]
  );

  const stageForNaming = useCallback((files: File[]) => {
    if (files.length === 0) return;
    revokePreviewUrl();
    const url = URL.createObjectURL(files[0]);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setPendingFiles(files);
    setSuggestedName(defaultScreenshotName());
    setStatus('naming');
    setStatusMessage(null);
    setErrorMessage(null);
  }, [revokePreviewUrl]);

  const confirmName = useCallback(
    async (name: string, uploadTarget?: ScreenshotUploadTarget | null) => {
      const files = pendingFiles;
      if (files.length === 0) return;
      await uploadCompressedFiles(files, name.trim(), uploadTarget);
    },
    [pendingFiles, uploadCompressedFiles]
  );

  const downloadByName = useCallback(
    (name: string) => {
      const url = previewUrlRef.current;
      if (!url) return;
      downloadImage(url, name.trim());
      setPendingFiles([]);
      reset();
    },
    [reset]
  );

  const cancelNaming = useCallback(() => {
    setPendingFiles([]);
    reset();
  }, [reset]);

  const uploadFromFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      stageForNaming(files);
    },
    [stageForNaming]
  );

  const captureAndUpload = useCallback(async () => {
    setStatus('capturing');
    setStatusMessage('Capturing screenshot...');
    setErrorMessage(null);

    try {
      const captured = await captureScreenshot();
      stageForNaming([captured]);
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
  }, [stageForNaming, reset]);

  const isBusy = status === 'capturing' || status === 'uploading';

  return {
    status,
    statusMessage,
    errorMessage,
    isBusy,
    isNaming: status === 'naming',
    suggestedName,
    previewUrl,
    uploadFromFiles,
    captureAndUpload,
    confirmName,
    downloadByName,
    cancelNaming,
    reset,
  };
}
