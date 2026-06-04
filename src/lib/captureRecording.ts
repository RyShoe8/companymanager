export class RecordingCaptureError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'unsupported'
      | 'permission_denied'
      | 'canceled'
      | 'capture_failed'
      | 'mic_denied'
      | 'system_audio_missing'
  ) {
    super(message);
    this.name = 'RecordingCaptureError';
  }
}

export type RecordingAudioSource = 'system' | 'mic';

export type RecordingCaptureResult = {
  videoFile: File;
  audioFile: File | null;
  durationSeconds: number;
  audioIncluded: boolean;
  audioSource: RecordingAudioSource;
};

export type RecordingSession = {
  begin: () => void;
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

type AudioMixContext = {
  audioContext: AudioContext;
  destination: MediaStreamAudioDestinationNode;
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

const MIN_VIDEO_BITRATE = 2_500_000;
const MAX_VIDEO_BITRATE = 16_000_000;
const DEFAULT_VIDEO_BITRATE = 6_000_000;
const AUDIO_BITRATE = 192_000;
const RECORDER_TIMESLICE_MS = 250;

function computeVideoBitrate(width: number, height: number): number {
  const pixels = Math.max(1, width * height);
  const computed = Math.round(pixels * 0.005);
  return Math.min(MAX_VIDEO_BITRATE, Math.max(MIN_VIDEO_BITRATE, computed || DEFAULT_VIDEO_BITRATE));
}

function createMixedAudioTrack(audioStreams: MediaStream[]): AudioMixContext | null {
  const tracks = audioStreams.flatMap((stream) => stream.getAudioTracks());
  if (tracks.length === 0) return null;

  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();

  for (const track of tracks) {
    const sourceStream = new MediaStream([track]);
    const source = audioContext.createMediaStreamSource(sourceStream);
    source.connect(destination);
  }

  return { audioContext, destination };
}

export function isRecordingCaptureSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}

export type PrepareRecordingSessionOptions = {
  audioSource: RecordingAudioSource;
  /** Called when the user stops screen sharing before recording begins. */
  onShareEnded?: () => void;
};

/** Acquire screen share and prepare recorders. Call begin() to start capture. */
export async function prepareRecordingSession(
  options: PrepareRecordingSessionOptions
): Promise<RecordingSession> {
  const { audioSource, onShareEnded } = options;

  if (!isRecordingCaptureSupported()) {
    throw new RecordingCaptureError(
      'Recording is unavailable in this browser. Please upload a video instead.',
      'unsupported'
    );
  }

  let displayStream: MediaStream | null = null;
  let micStream: MediaStream | null = null;
  let combinedStream: MediaStream | null = null;
  let audioMixContext: AudioMixContext | null = null;
  let videoRecorder: MediaRecorder | null = null;
  let audioRecorder: MediaRecorder | null = null;
  let canceled = false;
  let hasBegun = false;
  let autoStopTimer: number | null = null;
  let startedAt = 0;

  const videoChunks: Blob[] = [];
  const audioChunks: Blob[] = [];
  let audioIncluded = false;

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
    if (audioMixContext) {
      void audioMixContext.audioContext.close().catch(() => {});
      audioMixContext = null;
    }
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
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
      audio: audioSource === 'system',
      preferCurrentTab: false,
    };
    if (controller) {
      displayMediaOptions.controller = controller;
    }

    displayStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    keepCapturingPageFocused(controller, displayStream);

    const videoTrack = displayStream.getVideoTracks()[0];
    if (videoTrack) {
      try {
        videoTrack.contentHint = 'detail';
      } catch {
        // unsupported in some browsers
      }
    }

    if (audioSource === 'mic') {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
          video: false,
        });
      } catch {
        throw new RecordingCaptureError(
          'Microphone permission denied. Allow microphone access to record with your voice.',
          'mic_denied'
        );
      }
    }

    const displayAudioTracks = displayStream.getAudioTracks();
    const micAudioTracks = micStream?.getAudioTracks() ?? [];

    if (audioSource === 'system') {
      audioIncluded = displayAudioTracks.length > 0;
    } else {
      audioIncluded = micAudioTracks.length > 0;
    }

    const audioSourcesForMix: MediaStream[] = [];
    if (audioSource === 'system' && displayAudioTracks.length > 0) {
      audioSourcesForMix.push(new MediaStream(displayAudioTracks));
    }
    if (audioSource === 'mic' && micStream) {
      audioSourcesForMix.push(micStream);
    }

    audioMixContext = createMixedAudioTrack(audioSourcesForMix);
    const mixedAudioTrack = audioMixContext?.destination.stream.getAudioTracks()[0] ?? null;

    const videoTracks = displayStream.getVideoTracks();
    combinedStream = new MediaStream([
      ...videoTracks,
      ...(mixedAudioTrack ? [mixedAudioTrack] : []),
    ]);

    const videoSettings = videoTracks[0]?.getSettings();
    const videoWidth = videoSettings?.width ?? 1920;
    const videoHeight = videoSettings?.height ?? 1080;
    const videoBitsPerSecond = computeVideoBitrate(videoWidth, videoHeight);

    if (process.env.NODE_ENV === 'development') {
      console.info('[recording]', {
        mimeType: pickVideoMimeType(),
        width: videoWidth,
        height: videoHeight,
        bitrate: videoBitsPerSecond,
        audioSource,
        audioIncluded,
      });
    }

    const videoMimeType = pickVideoMimeType();
    const audioMimeType = pickAudioMimeType();

    videoRecorder = new MediaRecorder(combinedStream, {
      mimeType: videoMimeType,
      videoBitsPerSecond,
      audioBitsPerSecond: mixedAudioTrack ? AUDIO_BITRATE : undefined,
    });

    videoRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) videoChunks.push(event.data);
    };

    const audioStreamForSeparateFile =
      audioSource === 'mic' && micStream
        ? micStream
        : audioSource === 'system' && displayAudioTracks.length > 0
          ? new MediaStream(displayAudioTracks)
          : null;

    if (audioStreamForSeparateFile && audioStreamForSeparateFile.getAudioTracks().length > 0) {
      audioRecorder = new MediaRecorder(audioStreamForSeparateFile, {
        mimeType: audioMimeType,
        audioBitsPerSecond: AUDIO_BITRATE,
      });
      audioRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data);
      };
    }

    const displayTrack = displayStream.getVideoTracks()[0];
    displayTrack?.addEventListener(
      'ended',
      () => {
        if (canceled) return;
        if (videoRecorder?.state === 'recording') {
          void videoRecorder.stop();
        } else {
          canceled = true;
          cleanup();
          onShareEnded?.();
        }
      },
      { once: true }
    );

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
              audioIncluded,
              audioSource,
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
      begin: () => {
        if (canceled || hasBegun || !videoRecorder) return;
        hasBegun = true;
        startedAt = Date.now();
        videoRecorder.start(RECORDER_TIMESLICE_MS);
        audioRecorder?.start(RECORDER_TIMESLICE_MS);
        autoStopTimer = window.setTimeout(() => {
          if (videoRecorder?.state === 'recording') {
            videoRecorder.stop();
          }
        }, MAX_RECORDING_SECONDS * 1000);
      },
      stop: async () => {
        if (canceled) {
          throw new RecordingCaptureError('Recording was canceled.', 'canceled');
        }
        if (!hasBegun) {
          throw new RecordingCaptureError('Recording was not started.', 'canceled');
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

export function recordingAudioWarning(
  audioSource: RecordingAudioSource,
  audioIncluded: boolean
): string | null {
  if (audioIncluded) return null;
  if (audioSource === 'system') {
    return 'System audio was not shared. Enable "Share tab/system audio" in the screen picker.';
  }
  return 'Microphone was not available. Transcript may be limited without voice audio.';
}
