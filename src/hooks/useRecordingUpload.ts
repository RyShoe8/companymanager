'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  startRecordingSession,
  RecordingCaptureError,
  MAX_RECORDING_SECONDS,
  type RecordingSession,
} from '@/lib/captureRecording';
import type { MediaUploadTarget } from '@/lib/mediaUploadTarget';
import {
  createRecording,
  downloadVideoFile,
  pollRecordingUntilSettled,
  triggerRecordingProcess,
} from '@/lib/uploadRecording';

export type RecordingUploadStatus =
  | 'idle'
  | 'recording'
  | 'naming'
  | 'uploading'
  | 'processing'
  | 'success'
  | 'error';

export function defaultRecordingName(): string {
  const d = new Date();
  return `Recording ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function useRecordingUpload(
  target: MediaUploadTarget | null,
  onUploaded?: () => void
) {
  const [status, setStatus] = useState<RecordingUploadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [suggestedName, setSuggestedName] = useState(defaultRecordingName);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [micWarning, setMicWarning] = useState<string | null>(null);

  const sessionRef = useRef<RecordingSession | null>(null);
  const pendingVideoRef = useRef<File | null>(null);
  const pendingAudioRef = useRef<File | null>(null);
  const pendingDurationRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const successTimerRef = useRef<number | null>(null);

  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearSuccessTimer = useCallback(() => {
    if (successTimerRef.current != null) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      clearTimer();
      clearSuccessTimer();
      revokePreviewUrl();
      sessionRef.current?.cancel();
    },
    [clearTimer, clearSuccessTimer, revokePreviewUrl]
  );

  const reset = useCallback(() => {
    clearTimer();
    clearSuccessTimer();
    revokePreviewUrl();
    sessionRef.current?.cancel();
    sessionRef.current = null;
    pendingVideoRef.current = null;
    pendingAudioRef.current = null;
    pendingDurationRef.current = 0;
    setElapsedSeconds(0);
    setMicWarning(null);
    setStatus('idle');
    setStatusMessage(null);
    setErrorMessage(null);
  }, [clearTimer, clearSuccessTimer, revokePreviewUrl]);

  const stageForNaming = useCallback(
    (videoFile: File, audioFile: File | null, durationSeconds: number, micIncluded: boolean) => {
      revokePreviewUrl();
      const url = URL.createObjectURL(videoFile);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      pendingVideoRef.current = videoFile;
      pendingAudioRef.current = audioFile;
      pendingDurationRef.current = durationSeconds;
      setSuggestedName(defaultRecordingName());
      setMicWarning(
        micIncluded
          ? null
          : 'Microphone was not available. Transcript may be limited without voice audio.'
      );
      setStatus('naming');
      setStatusMessage(null);
      setErrorMessage(null);
    },
    [revokePreviewUrl]
  );

  const startRecording = useCallback(async () => {
    setStatus('recording');
    setStatusMessage('Starting recording...');
    setErrorMessage(null);
    setElapsedSeconds(0);

    try {
      const session = await startRecordingSession();
      sessionRef.current = session;
      setStatusMessage('Recording');
      clearTimer();
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            clearTimer();
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      if (error instanceof RecordingCaptureError && error.code === 'canceled') {
        reset();
        return;
      }
      setStatus('error');
      setErrorMessage(
        error instanceof RecordingCaptureError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to start recording.'
      );
      setStatusMessage(null);
    }
  }, [clearTimer, reset]);

  const stopRecording = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;

    clearTimer();
    setStatusMessage('Finalizing recording...');

    try {
      const result = await session.stop();
      sessionRef.current = null;
      stageForNaming(result.videoFile, result.audioFile, result.durationSeconds, result.micIncluded);
    } catch (error) {
      if (error instanceof RecordingCaptureError && error.code === 'canceled') {
        reset();
        return;
      }
      setStatus('error');
      setErrorMessage(
        error instanceof RecordingCaptureError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Failed to stop recording.'
      );
      setStatusMessage(null);
    }
  }, [clearTimer, reset, stageForNaming]);

  const uploadAndProcess = useCallback(
    async (name: string, uploadTarget?: MediaUploadTarget | null) => {
      const videoFile = pendingVideoRef.current;
      if (!videoFile) return;

      setStatus('uploading');
      setStatusMessage('Uploading recording...');
      setErrorMessage(null);

      const resolvedTarget = uploadTarget !== undefined ? uploadTarget : target;

      try {
        const created = await createRecording(videoFile, pendingAudioRef.current, {
          title: name.trim() || defaultRecordingName(),
          duration: pendingDurationRef.current,
          target: resolvedTarget,
        });

        setStatus('processing');
        setStatusMessage('Generating transcript and summary...');

        void triggerRecordingProcess(created.id).catch(() => {
          // Polling will surface failures.
        });

        await pollRecordingUntilSettled(created.id, (update) => {
          if (update.status === 'processing') {
            setStatusMessage('Generating transcript and summary...');
          }
        });

        setStatus('success');
        setStatusMessage('Recording saved');
        pendingVideoRef.current = null;
        pendingAudioRef.current = null;
        onUploaded?.();

        clearSuccessTimer();
        successTimerRef.current = window.setTimeout(() => {
          reset();
        }, 2000);
      } catch (error) {
        setStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'Failed to upload recording.'
        );
        setStatusMessage(null);
      } finally {
        revokePreviewUrl();
      }
    },
    [target, onUploaded, reset, clearSuccessTimer, revokePreviewUrl]
  );

  const confirmSave = useCallback(
    async (name: string, uploadTarget?: MediaUploadTarget | null) => {
      await uploadAndProcess(name, uploadTarget);
    },
    [uploadAndProcess]
  );

  const downloadByName = useCallback(
    (name: string) => {
      const file = pendingVideoRef.current;
      if (!file) return;
      downloadVideoFile(file, name.trim());
      reset();
    },
    [reset]
  );

  const cancelNaming = useCallback(() => {
    reset();
  }, [reset]);

  const uploadFromFiles = useCallback(
    async (files: File[]) => {
      const video = files.find((f) => f.type.startsWith('video/'));
      if (!video) {
        setStatus('error');
        setErrorMessage('Please select a video file.');
        return;
      }
      stageForNaming(video, null, 0, false);
    },
    [stageForNaming]
  );

  const isBusy =
    status === 'recording' || status === 'uploading' || status === 'processing';

  return {
    status,
    statusMessage,
    errorMessage,
    micWarning,
    isBusy,
    isRecording: status === 'recording',
    isNaming: status === 'naming',
    suggestedName,
    previewUrl,
    elapsedSeconds,
    elapsedLabel: formatElapsed(elapsedSeconds),
    startRecording,
    stopRecording,
    uploadFromFiles,
    confirmSave,
    downloadByName,
    cancelNaming,
    reset,
  };
}
