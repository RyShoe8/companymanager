'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  prepareRecordingSession,
  RecordingCaptureError,
  recordingAudioWarning,
  requestMicrophoneForRecording,
  MAX_RECORDING_SECONDS,
  STABILIZATION_SECONDS,
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
import {
  isAlreadyMp4,
  preloadFfmpeg,
  transcodeAudioToMp4,
  transcodeDebugInfo,
  transcodeFallbackWarning,
  transcodeRecordingToMp4,
  type TranscodeResult,
} from '@/lib/transcodeRecording';

export type RecordingUploadStatus =
  | 'idle'
  | 'preparing'
  | 'stabilizing'
  | 'armed'
  | 'recording'
  | 'converting'
  | 'naming'
  | 'uploading'
  | 'processing'
  | 'success'
  | 'error';

export type MicPermissionStatus = 'idle' | 'checking' | 'ready' | 'blocked';

export function defaultRecordingName(): string {
  const d = new Date();
  return `Recording ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const VIDEO_FILE_EXTENSION = /\.(mp4|webm|mov|m4v|mkv|avi|ogv)$/i;

function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) return true;
  return VIDEO_FILE_EXTENSION.test(file.name);
}

function postPopoutState(
  phase: 'stabilizing' | 'armed' | 'recording',
  elapsedSeconds: number,
  stabilizeSeconds?: number
): void {
  postRecordingPopoutMessage({ type: 'state', phase, elapsedSeconds, stabilizeSeconds });
}

export function useRecordingUpload(
  target: MediaUploadTarget | null,
  onUploaded?: () => void,
  onPrepared?: () => void
) {
  const [status, setStatus] = useState<RecordingUploadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [suggestedName, setSuggestedName] = useState(defaultRecordingName);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [micWarning, setMicWarning] = useState<string | null>(null);
  const [transcodeDebug, setTranscodeDebug] = useState<string | null>(null);
  const [stabilizeSecondsRemaining, setStabilizeSecondsRemaining] = useState(STABILIZATION_SECONDS);
  const [controlsInPopout, setControlsInPopout] = useState(false);
  const [micPermissionStatus, setMicPermissionStatus] = useState<MicPermissionStatus>('idle');
  const [micPermissionMessage, setMicPermissionMessage] = useState<string | null>(null);

  const sessionRef = useRef<RecordingSession | null>(null);
  const micPreflightStreamRef = useRef<MediaStream | null>(null);
  const pendingVideoRef = useRef<File | null>(null);
  const pendingAudioRef = useRef<File | null>(null);
  const pendingDurationRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const successTimerRef = useRef<number | null>(null);
  const popoutRef = useRef<Window | null>(null);
  const statusRef = useRef<RecordingUploadStatus>('idle');
  const elapsedSecondsRef = useRef(0);
  const stopInFlightRef = useRef(false);
  const stabilizeTimerRef = useRef<number | null>(null);
  const stopRecordingRef = useRef<() => Promise<void>>(async () => {});
  const beginRecordingRef = useRef<() => void>(() => {});
  const finishStabilizationRef = useRef<() => void>(() => {});
  const resetRef = useRef<() => void>(() => {});

  statusRef.current = status;
  elapsedSecondsRef.current = elapsedSeconds;

  const closePopout = useCallback(() => {
    closeRecordingControlsPopout(popoutRef.current);
    popoutRef.current = null;
    setControlsInPopout(false);
  }, []);

  const releaseMicPreflight = useCallback(() => {
    micPreflightStreamRef.current?.getTracks().forEach((track) => track.stop());
    micPreflightStreamRef.current = null;
    setMicPermissionStatus('idle');
    setMicPermissionMessage(null);
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

  const clearStabilizeTimer = useCallback(() => {
    if (stabilizeTimerRef.current != null) {
      window.clearInterval(stabilizeTimerRef.current);
      stabilizeTimerRef.current = null;
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
      clearStabilizeTimer();
      clearSuccessTimer();
      revokePreviewUrl();
      sessionRef.current?.cancel();
      micPreflightStreamRef.current?.getTracks().forEach((track) => track.stop());
      micPreflightStreamRef.current = null;
      closePopout();
    },
    [clearTimer, clearStabilizeTimer, clearSuccessTimer, revokePreviewUrl, closePopout]
  );

  const reset = useCallback(() => {
    clearTimer();
    clearStabilizeTimer();
    clearSuccessTimer();
    revokePreviewUrl();
    sessionRef.current?.cancel();
    sessionRef.current = null;
    micPreflightStreamRef.current?.getTracks().forEach((track) => track.stop());
    micPreflightStreamRef.current = null;
    setMicPermissionStatus('idle');
    setMicPermissionMessage(null);
    pendingVideoRef.current = null;
    pendingAudioRef.current = null;
    pendingDurationRef.current = 0;
    setElapsedSeconds(0);
    setStabilizeSecondsRemaining(STABILIZATION_SECONDS);
    setMicWarning(null);
    setTranscodeDebug(null);
    setStatus('idle');
    setStatusMessage(null);
    setErrorMessage(null);
    closePopout();
  }, [clearTimer, clearStabilizeTimer, clearSuccessTimer, revokePreviewUrl, closePopout]);

  resetRef.current = reset;

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

      try {
        let videoResult: TranscodeResult;

        if (isAlreadyMp4(videoFile)) {
          videoResult = { file: videoFile, usedFallback: false };
          setStatusMessage('Video ready');
        } else {
          videoResult = await transcodeRecordingToMp4(videoFile, (progress) => {
            setStatusMessage(progress.message);
          });
        }

        let finalAudio = audioFile;
        if (audioFile && !isAlreadyMp4(audioFile)) {
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
          warnings.push(transcodeFallbackWarning(videoResult));
          setTranscodeDebug(transcodeDebugInfo(videoResult));
        } else {
          setTranscodeDebug(null);
        }
        setMicWarning(warnings.length > 0 ? warnings.join(' ') : null);

        setStatus('naming');
        setStatusMessage(null);
        setErrorMessage(null);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[useRecordingUpload] finalizeCapture failed', error);
        }

        revokePreviewUrl();
        const url = URL.createObjectURL(videoFile);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        pendingVideoRef.current = videoFile;
        pendingAudioRef.current = audioFile;
        pendingDurationRef.current = durationSeconds;
        setSuggestedName(defaultRecordingName());

        const warnings: string[] = [];
        const audioWarning = recordingAudioWarning(audioSource, audioIncluded);
        if (audioWarning) warnings.push(audioWarning);
        const fallbackResult: TranscodeResult = {
          file: videoFile,
          usedFallback: true,
          failureStage: 'exec',
          failureReason: error instanceof Error ? error.message : String(error),
        };
        warnings.push(transcodeFallbackWarning(fallbackResult));
        setTranscodeDebug(transcodeDebugInfo(fallbackResult));
        setMicWarning(warnings.join(' '));

        setStatus('naming');
        setStatusMessage(null);
        setErrorMessage(null);
      }
    },
    [revokePreviewUrl, closePopout]
  );

  const stopRecording = useCallback(async () => {
    if (stopInFlightRef.current) return;

    const session = sessionRef.current;
    if (!session) return;

    const wasRecording = statusRef.current === 'recording';
    stopInFlightRef.current = true;
    clearTimer();
    closePopout();
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
        if (wasRecording) {
          setStatus('error');
          setErrorMessage(
            error.message || 'Recording could not be finalized. Try recording again.'
          );
          setStatusMessage(null);
        } else {
          reset();
        }
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
    } finally {
      stopInFlightRef.current = false;
    }
  }, [clearTimer, reset, finalizeCapture, closePopout]);

  stopRecordingRef.current = stopRecording;

  const beginRecording = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;

    session.begin();
    setStatus('recording');
    setStatusMessage('Recording');
    setElapsedSeconds(0);
    postPopoutState('recording', 0);

    clearTimer();
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next >= MAX_RECORDING_SECONDS) {
          clearTimer();
        }
        if (popoutRef.current && !popoutRef.current.closed) {
          postPopoutState('recording', next);
        }
        return next;
      });
    }, 1000);
  }, [clearTimer]);

  beginRecordingRef.current = beginRecording;

  const finishStabilization = useCallback(() => {
    clearStabilizeTimer();
    setStabilizeSecondsRemaining(0);
    setStatus('armed');
    setStatusMessage(null);
    postPopoutState('armed', 0);
  }, [clearStabilizeTimer]);

  finishStabilizationRef.current = finishStabilization;

  const skipStabilization = useCallback(() => {
    if (statusRef.current !== 'stabilizing') return;
    finishStabilization();
  }, [finishStabilization]);

  const startStabilizationCountdown = useCallback(() => {
    clearStabilizeTimer();
    setStabilizeSecondsRemaining(STABILIZATION_SECONDS);
    postPopoutState('stabilizing', 0, STABILIZATION_SECONDS);

    stabilizeTimerRef.current = window.setInterval(() => {
      setStabilizeSecondsRemaining((prev) => {
        if (prev <= 0) return 0;
        const next = prev - 1;
        if (popoutRef.current && !popoutRef.current.closed) {
          postPopoutState('stabilizing', 0, next);
        }
        if (next <= 0) {
          clearStabilizeTimer();
          finishStabilizationRef.current();
        }
        return next;
      });
    }, 1000);
  }, [clearStabilizeTimer]);

  useEffect(() => {
    if (status !== 'stabilizing' && status !== 'armed' && status !== 'recording') return;

    const unsubscribe = subscribeRecordingPopoutMessages((message) => {
      if (message.type === 'start') {
        beginRecordingRef.current();
      }
      if (message.type === 'skip_stabilize') {
        finishStabilizationRef.current();
      }
      if (message.type === 'stop') {
        void stopRecordingRef.current();
      }
      if (message.type === 'ready') {
        const currentStatus = statusRef.current;
        if (currentStatus === 'stabilizing') {
          postPopoutState('stabilizing', 0, STABILIZATION_SECONDS);
        } else if (currentStatus === 'armed') {
          postPopoutState('armed', 0);
        } else if (currentStatus === 'recording') {
          postPopoutState('recording', elapsedSecondsRef.current);
        }
      }
      if (message.type === 'closed') {
        popoutRef.current = null;
        setControlsInPopout(false);
        if (stopInFlightRef.current) return;

        const currentStatus = statusRef.current;
        if (currentStatus === 'stabilizing' || currentStatus === 'armed') {
          sessionRef.current?.cancel();
          sessionRef.current = null;
          resetRef.current();
        } else if (currentStatus === 'recording') {
          void stopRecordingRef.current();
        }
      }
    });

    return unsubscribe;
  }, [status]);

  const requestMicPermission = useCallback(async () => {
    releaseMicPreflight();
    setMicPermissionStatus('checking');
    setMicPermissionMessage(null);
    setErrorMessage(null);
    try {
      const stream = await requestMicrophoneForRecording();
      micPreflightStreamRef.current = stream;
      setMicPermissionStatus('ready');
    } catch (error) {
      micPreflightStreamRef.current = null;
      setMicPermissionStatus('blocked');
      setMicPermissionMessage(
        error instanceof RecordingCaptureError
          ? error.message
          : 'Microphone access failed. Check browser site settings or choose System audio.'
      );
    }
  }, [releaseMicPreflight]);

  const clearMicPreflight = useCallback(() => {
    releaseMicPreflight();
  }, [releaseMicPreflight]);

  const prepareRecording = useCallback(
    async (audioSource: RecordingAudioSource) => {
      setStatus('preparing');
      setStatusMessage(
        audioSource === 'mic'
          ? 'Select a screen or window to share…'
          : 'Select a screen or window to share…'
      );
      setErrorMessage(null);
      setElapsedSeconds(0);
      setControlsInPopout(false);

      try {
        const session = await prepareRecordingSession({
          audioSource,
          micStream: audioSource === 'mic' ? micPreflightStreamRef.current : null,
          onShareEnded: () => {
            sessionRef.current = null;
            resetRef.current();
          },
        });
        sessionRef.current = session;
        micPreflightStreamRef.current = null;
        setMicPermissionStatus('idle');
        setMicPermissionMessage(null);
        preloadFfmpeg();

        const popup = openRecordingControlsPopout();
        popoutRef.current = popup;
        const usingPopout = popup != null && !popup.closed;
        setControlsInPopout(usingPopout);

        setStatus('stabilizing');
        setStatusMessage(
          'Let the shared window reach full quality before recording (streaming video often dips briefly after share).'
        );
        startStabilizationCountdown();
        onPrepared?.();
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
              : 'Failed to prepare recording.'
        );
        setStatusMessage(null);
        setStatus('idle');
      }
    },
    [closePopout, reset, onPrepared, startStabilizationCountdown]
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
      const video = files.find(isVideoFile);
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
    status === 'preparing' ||
    status === 'stabilizing' ||
    status === 'armed' ||
    status === 'recording' ||
    status === 'converting' ||
    status === 'uploading' ||
    status === 'processing';

  return {
    status,
    statusMessage,
    errorMessage,
    micWarning,
    transcodeDebug,
    isBusy,
    isPreparing: status === 'preparing',
    isStabilizing: status === 'stabilizing',
    isArmed: status === 'armed',
    isRecording: status === 'recording',
    isConverting: status === 'converting',
    isNaming: status === 'naming',
    controlsInPopout,
    suggestedName,
    previewUrl,
    elapsedSeconds,
    stabilizeSecondsRemaining,
    elapsedLabel: formatElapsed(elapsedSeconds),
    micPermissionStatus,
    micPermissionMessage,
    requestMicPermission,
    clearMicPreflight,
    prepareRecording,
    skipStabilization,
    beginRecording,
    stopRecording,
    uploadFromFiles,
    confirmSave,
    downloadByName,
    cancelNaming,
    reset,
  };
}

export type RecordingUploadControl = ReturnType<typeof useRecordingUpload>;
