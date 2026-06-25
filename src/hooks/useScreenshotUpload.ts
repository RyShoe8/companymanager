'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  captureDisplayFrame,
  ScreenshotCaptureError,
  type ScreenshotCaptureMode,
} from '@/lib/captureScreenshot';
import { compressImageFile } from '@/lib/compressImageFile';
import { cropImageFile, type ImageCropRect } from '@/lib/cropImageFile';
import { downloadImage } from '@/lib/downloadImage';
import {
  uploadScreenshotAsset,
  type ScreenshotUploadTarget,
} from '@/lib/uploadScreenshotAsset';

export type ScreenshotUploadStatus =
  | 'idle'
  | 'capturing'
  | 'selecting_region'
  | 'naming'
  | 'uploading'
  | 'success'
  | 'error';

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
  onUploaded?: (asset?: Awaited<ReturnType<typeof uploadScreenshotAsset>>) => void
) {
  const [status, setStatus] = useState<ScreenshotUploadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [suggestedName, setSuggestedName] = useState(defaultScreenshotName);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [regionPreviewUrl, setRegionPreviewUrl] = useState<string | null>(null);
  const [regionSourceFile, setRegionSourceFile] = useState<File | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const regionPreviewUrlRef = useRef<string | null>(null);
  const successTimerRef = useRef<number | null>(null);

  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const revokeRegionPreviewUrl = useCallback(() => {
    if (regionPreviewUrlRef.current) {
      URL.revokeObjectURL(regionPreviewUrlRef.current);
      regionPreviewUrlRef.current = null;
    }
    setRegionPreviewUrl(null);
  }, []);

  const clearSuccessTimer = useCallback(() => {
    if (successTimerRef.current != null) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearSuccessTimer();
      revokePreviewUrl();
      revokeRegionPreviewUrl();
    },
    [clearSuccessTimer, revokePreviewUrl, revokeRegionPreviewUrl]
  );

  const reset = useCallback(() => {
    clearSuccessTimer();
    revokePreviewUrl();
    revokeRegionPreviewUrl();
    setRegionSourceFile(null);
    setStatus('idle');
    setStatusMessage(null);
    setErrorMessage(null);
    setPendingFiles([]);
  }, [clearSuccessTimer, revokePreviewUrl, revokeRegionPreviewUrl]);

  const uploadCompressedFiles = useCallback(
    async (files: File[], name: string, uploadTarget?: ScreenshotUploadTarget | null) => {
      setStatus('uploading');
      setStatusMessage('Uploading screenshot...');
      setErrorMessage(null);

      const resolvedTarget = uploadTarget !== undefined ? uploadTarget : target;

      try {
        let lastAsset: Awaited<ReturnType<typeof uploadScreenshotAsset>> | undefined;
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const compressed = await prepareFileForUpload(file);
          const assetName = files.length > 1 ? `${name} (${i + 1})` : name;
          lastAsset = await uploadScreenshotAsset(compressed, resolvedTarget, { name: assetName });
        }

        setStatus('success');
        setStatusMessage('✓ Screenshot attached');
        setPendingFiles([]);
        onUploaded?.(lastAsset);

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

  const stageForNaming = useCallback(
    async (files: File[]) => {
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
    },
    [revokePreviewUrl]
  );

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

  const handleCaptureError = useCallback(
    (error: unknown) => {
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
    },
    [reset]
  );
  const captureFromUrl = useCallback(
    async (url: string) => {
      setStatus('capturing');
      setStatusMessage('Capturing full page from URL...');
      setErrorMessage(null);

      try {
        const res = await fetch('/api/screenshots/capture-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'Failed to capture URL screenshot');
        }

        const blob = await res.blob();
        const file = new File([blob], `screenshot-${new Date().getTime()}.png`, { type: 'image/png' });

        await stageForNaming([file]);
      } catch (error) {
        handleCaptureError(error);
      }
    },
    [stageForNaming, handleCaptureError]
  );

  const startCapture = useCallback(
    async (mode: ScreenshotCaptureMode) => {
      setStatus('capturing');
      setStatusMessage('Capturing screenshot...');
      setErrorMessage(null);

      try {
        const captured = await captureDisplayFrame();

        if (mode === 'full') {
          await stageForNaming([captured]);
          return;
        }

        revokeRegionPreviewUrl();
        const url = URL.createObjectURL(captured);
        regionPreviewUrlRef.current = url;
        setRegionPreviewUrl(url);
        setRegionSourceFile(captured);
        setStatus('selecting_region');
        setStatusMessage(null);
      } catch (error) {
        handleCaptureError(error);
      }
    },
    [stageForNaming, revokeRegionPreviewUrl, handleCaptureError]
  );

  const confirmRegion = useCallback(
    async (rect: ImageCropRect) => {
      const source = regionSourceFile;
      if (!source) return;

      setStatus('capturing');
      setStatusMessage('Cropping selection...');
      setErrorMessage(null);

      try {
        const cropped = await cropImageFile(source, rect);
        revokeRegionPreviewUrl();
        setRegionSourceFile(null);
        await stageForNaming([cropped]);
      } catch (error) {
        setStatus('selecting_region');
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to crop screenshot selection.'
        );
        setStatusMessage(null);
      }
    },
    [regionSourceFile, revokeRegionPreviewUrl, stageForNaming]
  );

  const cancelRegionSelection = useCallback(() => {
    revokeRegionPreviewUrl();
    setRegionSourceFile(null);
    reset();
  }, [revokeRegionPreviewUrl, reset]);

  const captureAndUpload = useCallback(async () => {
    await startCapture('full');
  }, [startCapture]);

  const isBusy = status === 'capturing' || status === 'uploading';
  const isSelectingRegion = status === 'selecting_region';

  return {
    status,
    statusMessage,
    errorMessage,
    isBusy,
    isSelectingRegion,
    isNaming: status === 'naming',
    suggestedName,
    previewUrl,
    regionPreviewUrl,
    uploadFromFiles,
    startCapture,
    captureFromUrl,
    captureAndUpload,
    confirmRegion,
    cancelRegionSelection,
    confirmName,
    downloadByName,
    cancelNaming,
    reset,
  };
}
