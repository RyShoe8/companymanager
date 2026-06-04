export class RecordingCaptureError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'unsupported'
      | 'permission_denied'
      | 'canceled'
      | 'capture_failed'
      | 'mic_denied'
  ) {
    super(message);
    this.name = 'RecordingCaptureError';
  }
}

export type RecordingCaptureResult = {
  videoFile: File;
  audioFile: File | null;
  durationSeconds: number;
  micIncluded: boolean;
};

export type RecordingSession = {
  stop: () => Promise<RecordingCaptureResult>;
  cancel: () => void;
};

export const MAX_RECORDING_SECONDS = 20 * 60;

type CaptureStartFocusBehavior = 'focus-capturing-application' | 'focus-captured-surface' | 'no-focus-change';

interface CaptureControllerLike {
  setFocusBehavior(behavior: CaptureStartFocusBehavior): void;
}

type DisplayMediaOptionsWithController = DisplayMediaStreamOptions & {
  controller?: CaptureControllerLike;
  preferCurrentTab?: boolean;
};

function createCaptureController(): CaptureControllerLike | null {
  const CaptureControllerCtor = (globalThis as { CaptureController?: new () => CaptureControllerLike })
    .CaptureController;
  if (!CaptureControllerCtor) return null;
  try {
    return new CaptureControllerCtor();
  } catch {
    return null;
  }
}

function keepCapturingPageFocused(
  controller: CaptureControllerLike | null,
  stream: MediaStream
): void {
  const videoTrack = stream.getVideoTracks()[0];
  const displaySurface = videoTrack?.getSettings().displaySurface;

  if (controller && (displaySurface === 'browser' || displaySurface === 'window')) {
    try {
      controller.setFocusBehavior('focus-capturing-application');
      return;
    } catch {
      // fall through
    }
  }

  if (typeof window !== 'undefined') {
    window.focus();
  }
}

function mapCaptureError(error: unknown): RecordingCaptureError {
  if (error instanceof RecordingCaptureError) return error;

  const domError = error as DOMException;
  if (domError?.name === 'NotAllowedError') {
    return new RecordingCaptureError(
      'Permission denied. Allow screen sharing to record.',
      'permission_denied'
    );
  }
  if (domError?.name === 'AbortError') {
    return new RecordingCaptureError('Recording was canceled.', 'canceled');
  }

  return new RecordingCaptureError('Failed to start recording.', 'capture_failed');
}

function pickVideoMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'video/webm';
}

function pickAudioMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'audio/webm';
}

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

function chunksToFile(chunks: Blob[], mimeType: string, fileName: string): File {
  const blob = new Blob(chunks, { type: mimeType });
  return new File([blob], fileName, { type: mimeType.split(';')[0] || mimeType });
}

export function isRecordingCaptureSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}

/** Start a screen + optional mic recording session. Call stop() to finalize files. */
export async function startRecordingSession(): Promise<RecordingSession> {
  if (!isRecordingCaptureSupported()) {
    throw new RecordingCaptureError(
      'Recording is unavailable in this browser. Please upload a video instead.',
      'unsupported'
    );
  }

  let displayStream: MediaStream | null = null;
  let micStream: MediaStream | null = null;
  let combinedStream: MediaStream | null = null;
  let videoRecorder: MediaRecorder | null = null;
  let audioRecorder: MediaRecorder | null = null;
  let canceled = false;
  let autoStopTimer: number | null = null;
  const startedAt = Date.now();

  const videoChunks: Blob[] = [];
  const audioChunks: Blob[] = [];
  let micIncluded = false;

  const cleanup = () => {
    if (autoStopTimer != null) {
      window.clearTimeout(autoStopTimer);
      autoStopTimer = null;
    }
    stopStream(combinedStream);
    stopStream(displayStream);
    stopStream(micStream);
    combinedStream = null;
    displayStream = null;
    micStream = null;
  };

  try {
    const controller = createCaptureController();
    if (controller) {
      try {
        controller.setFocusBehavior('focus-capturing-application');
      } catch {
        // unsupported before getDisplayMedia
      }
    }

    const displayMediaOptions: DisplayMediaOptionsWithController = {
      video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        frameRate: { ideal: 30, max: 30 },
      },
      audio: false,
      preferCurrentTab: false,
    };
    if (controller) {
      displayMediaOptions.controller = controller;
    }

    displayStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    keepCapturingPageFocused(controller, displayStream);

    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      });
      micIncluded = true;
    } catch {
      micIncluded = false;
    }

    const videoTracks = displayStream.getVideoTracks();
    const audioTracks = micStream?.getAudioTracks() ?? [];
    combinedStream = new MediaStream([...videoTracks, ...audioTracks]);

    const videoMimeType = pickVideoMimeType();
    const audioMimeType = pickAudioMimeType();

    videoRecorder = new MediaRecorder(combinedStream, {
      mimeType: videoMimeType,
      videoBitsPerSecond: 1_500_000,
      audioBitsPerSecond: micIncluded ? 128_000 : undefined,
    });

    videoRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) videoChunks.push(event.data);
    };

    if (micStream && micStream.getAudioTracks().length > 0) {
      audioRecorder = new MediaRecorder(micStream, {
        mimeType: audioMimeType,
        audioBitsPerSecond: 128_000,
      });
      audioRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      };
    }

    const displayTrack = displayStream.getVideoTracks()[0];
    displayTrack?.addEventListener(
      'ended',
      () => {
        if (videoRecorder?.state === 'recording') {
          void videoRecorder.stop();
        }
      },
      { once: true }
    );

    videoRecorder.start(1000);
    audioRecorder?.start(1000);

    autoStopTimer = window.setTimeout(() => {
      if (videoRecorder?.state === 'recording') {
        videoRecorder.stop();
      }
    }, MAX_RECORDING_SECONDS * 1000);

    const finalize = (): Promise<RecordingCaptureResult> =>
      new Promise((resolve, reject) => {
        let videoDone = false;
        let audioDone = !audioRecorder;

        const maybeResolve = () => {
          if (videoDone && audioDone) {
            cleanup();
            const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const videoFile = chunksToFile(
              videoChunks,
              videoMimeType,
              `recording-${timestamp}.webm`
            );
            const audioFile =
              audioChunks.length > 0
                ? chunksToFile(audioChunks, audioMimeType, `recording-audio-${timestamp}.webm`)
                : null;
            resolve({
              videoFile,
              audioFile,
              durationSeconds,
              micIncluded,
            });
          }
        };

        if (!videoRecorder) {
          reject(new RecordingCaptureError('Recorder not initialized.', 'capture_failed'));
          return;
        }

        videoRecorder.onstop = () => {
          videoDone = true;
          maybeResolve();
        };
        videoRecorder.onerror = () => {
          reject(new RecordingCaptureError('Recording failed.', 'capture_failed'));
        };

        if (audioRecorder) {
          audioRecorder.onstop = () => {
            audioDone = true;
            maybeResolve();
          };
          audioRecorder.onerror = () => {
            audioDone = true;
            maybeResolve();
          };
        }
      });

    return {
      stop: async () => {
        if (canceled) {
          throw new RecordingCaptureError('Recording was canceled.', 'canceled');
        }
        if (videoRecorder?.state === 'recording') {
          videoRecorder.stop();
        }
        if (audioRecorder?.state === 'recording') {
          audioRecorder.stop();
        }
        return finalize();
      },
      cancel: () => {
        canceled = true;
        if (videoRecorder?.state === 'recording') {
          try {
            videoRecorder.stop();
          } catch {
            // ignore
          }
        }
        if (audioRecorder?.state === 'recording') {
          try {
            audioRecorder.stop();
          } catch {
            // ignore
          }
        }
        cleanup();
      },
    };
  } catch (error) {
    cleanup();
    throw mapCaptureError(error);
  }
}
