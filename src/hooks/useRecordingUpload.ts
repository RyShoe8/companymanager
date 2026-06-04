'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  startRecordingSession,
  RecordingCaptureError,
  recordingAudioWarning,
  MAX_RECORDING_SECONDS,
  type RecordingAudioSource,
  type RecordingSession,
} from '@/lib/captureRecording';
import type { MediaUploadTarget } from '@/lib/mediaUploadTarget';
import {
  createRecording,
  downloadVideoFile,
  pollRecordingUntilSettled,
  triggerRecordingProcess,
} from '@/lib/uploadRecording';
import {
  closeRecordingControlsPopout,
  openRecordingControlsPopout,
} from '@/lib/recordings/openRecordingControlsPopout';
import {
  postRecordingPopoutMessage,
  subscribeRecordingPopoutMessages,
} from '@/lib/recordings/recordingPopoutSync';
import { transcodeAudioToMp4, transcodeRecordingToMp4 } from '@/lib/transcodeRecording';

export type RecordingUploadStatus =
  | 'idle'
  | 'recording'
  | 'converting'
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
  const [controlsInPopout, setControlsInPopout] = useState(false);

  const sessionRef = useRef<RecordingSession | null>(null);
  const pendingVideoRef = useRef<File | null>(null);
  const pendingAudioRef = useRef<File | null>(null);
  const pendingDurationRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const successTimerRef = useRef<number | null>(null);
  const popoutRef = useRef<Window | null>(null);
  const stopRecordingRef = useRef<() => Promise<void>>(async () => {});

  const closePopout = useCallback(() => {
    closeRecordingControlsPopout(popoutRef.current);
    popoutRef.current = null;
    setControlsInPopout(false);
  }, []);

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
      closePopout();
    },
    [clearTimer, clearSuccessTimer, revokePreviewUrl, closePopout]
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
    closePopout();
  }, [clearTimer, clearSuccessTimer, revokePreviewUrl, closePopout]);

  const finalizeCapture = useCallback(
    async (
      videoFile: File,
      audioFile: File | null,
      durationSeconds: number,
      audioSource: RecordingAudioSource,
      audioIncluded: boolean
    ) => {
      closePopout();
      setStatus('converting');
      setStatusMessage('Preparing video…');

      const videoResult = await transcodeRecordingToMp4(videoFile, (progress) => {
        setStatusMessage(progress.message);
      });

      let finalAudio = audioFile;
      if (audioFile) {
        const mp4Audio = await transcodeAudioToMp4(audioFile);
        if (mp4Audio) finalAudio = mp4Audio;
      }

      revokePreviewUrl();
      const url = URL.createObjectURL(videoResult.file);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      pendingVideoRef.current = videoResult.file;
      pendingAudioRef.current = finalAudio;
      pendingDurationRef.current = durationSeconds;
      setSuggestedName(defaultRecordingName());

      const warnings: string[] = [];
      const audioWarning = recordingAudioWarning(audioSource, audioIncluded);
      if (audioWarning) warnings.push(audioWarning);
      if (videoResult.usedFallback) {
        warnings.push(
          'Could not convert to MP4 in this browser. The file is WebM — use Chrome or Edge to play, or re-record on a desktop browser.'
        );
      }
      setMicWarning(warnings.length > 0 ? warnings.join(' ') : null);

      setStatus('naming');
      setStatusMessage(null);
      setErrorMessage(null);
    },
    [revokePreviewUrl, closePopout]
  );

  const stopRecording = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;

    clearTimer();
    setStatusMessage('Finalizing recording...');

    try {
      const result = await session.stop();
      sessionRef.current = null;
      await finalizeCapture(
        result.videoFile,
        result.audioFile,
        result.durationSeconds,
        result.audioSource,
        result.audioIncluded
      );
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
      closePopout();
    }
  }, [clearTimer, reset, finalizeCapture, closePopout]);

  stopRecordingRef.current = stopRecording;

  useEffect(() => {
    if (status !== 'recording') return;

    const unsubscribe = subscribeRecordingPopoutMessages((message) => {
      if (message.type === 'stop') {
        void stopRecordingRef.current();
      }
      if (message.type === 'closed') {
        popoutRef.current = null;
        setControlsInPopout(false);
      }
    });

    return unsubscribe;
  }, [status]);

  const startRecording = useCallback(
    async (audioSource: RecordingAudioSource) => {
      setStatus('recording');
      setStatusMessage('Starting recording...');
      setErrorMessage(null);
      setElapsedSeconds(0);
      setControlsInPopout(false);

      try {
        const session = await startRecordingSession({ audioSource });
        sessionRef.current = session;
        setStatusMessage('Recording');

        const popup = openRecordingControlsPopout();
        popoutRef.current = popup;
        const usingPopout = popup != null && !popup.closed;
        setControlsInPopout(usingPopout);
        if (usingPopout) {
          postRecordingPopoutMessage({ type: 'tick', elapsedSeconds: 0 });
        }

        clearTimer();
        timerRef.current = window.setInterval(() => {
          setElapsedSeconds((prev) => {
            const next = prev + 1;
            if (next >= MAX_RECORDING_SECONDS) {
              clearTimer();
            }
            if (popoutRef.current && !popoutRef.current.closed) {
              postRecordingPopoutMessage({ type: 'tick', elapsedSeconds: next });
            }
            return next;
          });
        }, 1000);
      } catch (error) {
        closePopout();
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
        setStatus('idle');
      }
    },
    [clearTimer, reset, closePopout]
  );

  const stageForNaming = useCallback(
    (videoFile: File, audioFile: File | null) => {
      revokePreviewUrl();
      const url = URL.createObjectURL(videoFile);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      pendingVideoRef.current = videoFile;
      pendingAudioRef.current = audioFile;
      pendingDurationRef.current = 0;
      setSuggestedName(defaultRecordingName());
      setMicWarning(null);
      setStatus('naming');
      setStatusMessage(null);
      setErrorMessage(null);
    },
    [revokePreviewUrl]
  );

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
      stageForNaming(video, null);
    },
    [stageForNaming]
  );

  const isBusy =
    status === 'recording' ||
    status === 'converting' ||
    status === 'uploading' ||
    status === 'processing';

  return {
    status,
    statusMessage,
    errorMessage,
    micWarning,
    isBusy,
    isRecording: status === 'recording',
    isConverting: status === 'converting',
    isNaming: status === 'naming',
    controlsInPopout,
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

export type RecordingUploadControl = ReturnType<typeof useRecordingUpload>;
