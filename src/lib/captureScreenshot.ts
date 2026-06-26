import { isTouchMobileDevice } from '@/lib/capture/mobileCapture';

export type ScreenshotCaptureMode = 'full' | 'region';

export class ScreenshotCaptureError extends Error {
  constructor(
    message: string,
    public readonly code: 'unsupported' | 'permission_denied' | 'canceled' | 'capture_failed'
  ) {
    super(message);
    this.name = 'ScreenshotCaptureError';
  }
}

export function isScreenshotCaptureSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function'
  );
}

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

/** Keep the capturing page focused after the user picks a tab or window to share. */
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
      // Monitor shares or focus behavior already finalized — fall through.
    }
  }

  if (typeof window !== 'undefined') {
    window.focus();
  }
}

function mapCaptureError(error: unknown): ScreenshotCaptureError {
  if (error instanceof ScreenshotCaptureError) return error;

  const domError = error as DOMException;
  if (domError?.name === 'NotAllowedError') {
    return new ScreenshotCaptureError(
      'Permission denied. Allow screen sharing to capture a screenshot.',
      'permission_denied'
    );
  }
  if (domError?.name === 'AbortError') {
    return new ScreenshotCaptureError('Screenshot capture was canceled.', 'canceled');
  }

  return new ScreenshotCaptureError('Failed to capture screenshot.', 'capture_failed');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

function canvasToFile(canvas: HTMLCanvasElement, fileName: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new ScreenshotCaptureError('Failed to convert screenshot to image.', 'capture_failed'));
          return;
        }
        resolve(new File([blob], fileName, { type: 'image/png' }));
      },
      'image/png'
    );
  });
}

async function waitForCapturableFrame(
  video: HTMLVideoElement,
  timeoutMs = 1500
): Promise<void> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
      await delay(50);
      return;
    }
    await delay(50);
  }

  if (video.videoWidth > 0 && video.videoHeight > 0) {
    return;
  }

  throw new ScreenshotCaptureError('Could not read screenshot dimensions.', 'capture_failed');
}

/** Capture a single frame from user-selected display media (tab, window, or screen). */
export async function captureDisplayFrame(): Promise<File> {
  if (!isScreenshotCaptureSupported()) {
    throw new ScreenshotCaptureError(
      'Screenshot capture is unavailable in this browser. Please upload an image instead.',
      'unsupported'
    );
  }

  let stream: MediaStream | null = null;
  let canceledBeforeCapture = false;

  try {
    const controller = createCaptureController();
    if (controller) {
      try {
        controller.setFocusBehavior('focus-capturing-application');
      } catch {
        // Unsupported before getDisplayMedia in some browsers — retry after selection.
      }
    }

    const displayMediaOptions: DisplayMediaOptionsWithController = {
      video: true,
      audio: false,
      preferCurrentTab: isTouchMobileDevice(),
    };
    if (controller) {
      displayMediaOptions.controller = controller;
    }

    stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

    keepCapturingPageFocused(controller, stream);

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.addEventListener(
        'ended',
        () => {
          if (video.videoWidth === 0 || video.videoHeight === 0) {
            canceledBeforeCapture = true;
          }
        },
        { once: true }
      );
    }

    await video.play();
    await waitForCapturableFrame(video);

    if (canceledBeforeCapture) {
      throw new ScreenshotCaptureError('Screenshot capture was canceled.', 'canceled');
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      throw new ScreenshotCaptureError('Could not read screenshot dimensions.', 'capture_failed');
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new ScreenshotCaptureError('Failed to render screenshot.', 'capture_failed');
    }

    ctx.drawImage(video, 0, 0, width, height);

    stopStream(stream);
    stream = null;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return await canvasToFile(canvas, `screenshot-${timestamp}.png`);
  } catch (error) {
    throw mapCaptureError(error);
  } finally {
    stopStream(stream);
  }
}

/** @deprecated Use captureDisplayFrame */
export async function captureScreenshot(): Promise<File> {
  return captureDisplayFrame();
}
