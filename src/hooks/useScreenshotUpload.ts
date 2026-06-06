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

const UPLOADABLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function needsCompression(file: File): boolean {
  return file.type !== 'image/webp' && file.type !== 'image/jpeg';
}

function unsupportedImageMessage(): string {
  return 'Could not process this image. Try saving as JPEG or PNG, then upload again.';
}

async function compressOrFallback(file: File): Promise<File> {
  try {
    return await compressImageFile(file);
  } catch {
    if (UPLOADABLE_IMAGE_TYPES.has(file.type)) {
      return file;
    }
    throw new Error(unsupportedImageMessage());
  }
}

async function prepareFileForUpload(file: File): Promise<File> {
  if (!needsCompression(file)) {
    return file;
  }
  try {
    return await compressImageFile(file);
  } catch {
    if (UPLOADABLE_IMAGE_TYPES.has(file.type)) {
      return file;
    }
    throw new Error(unsupportedImageMessage());
  }
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
          const compressed = await prepareFileForUpload(file);
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

  const stageForNaming = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    revokePreviewUrl();
    setStatusMessage('Compressing screenshot...');
    setErrorMessage(null);

    try {
      const compressed = await Promise.all(files.map(compressOrFallback));

      const url = URL.createObjectURL(compressed[0]);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setPendingFiles(compressed);
      setSuggestedName(defaultScreenshotName());
      setStatus('naming');
      setStatusMessage(null);
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to prepare screenshot for upload.'
      );
      setStatusMessage(null);
      setPendingFiles([]);
    }
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
      const file = pendingFiles[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const ext = file.type === 'image/jpeg' ? '.jpg' : '.webp';
      const baseName = name.trim().replace(/\.[^/.]+$/, '') || 'screenshot';
      downloadImage(url, `${baseName}${ext}`);
      URL.revokeObjectURL(url);
      setPendingFiles([]);
      reset();
    },
    [pendingFiles, reset]
  );

  const cancelNaming = useCallback(() => {
    setPendingFiles([]);
    reset();
  }, [reset]);

  const uploadFromFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      await stageForNaming(files);
    },
    [stageForNaming]
  );

  const captureAndUpload = useCallback(async () => {
    setStatus('capturing');
    setStatusMessage('Capturing screenshot...');
    setErrorMessage(null);

    try {
      const captured = await captureScreenshot();
      await stageForNaming([captured]);
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
