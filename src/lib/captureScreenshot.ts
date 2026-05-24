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

function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const onReady = () => {
      requestAnimationFrame(() => resolve());
    };

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      onReady();
      return;
    }

    video.addEventListener('loadedmetadata', onReady, { once: true });
    video.addEventListener('error', () => reject(new ScreenshotCaptureError('Failed to read screen capture.', 'capture_failed')), {
      once: true,
    });
  });
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

/** Capture a single frame from user-selected display media (tab, window, or screen). */
export async function captureScreenshot(): Promise<File> {
  if (!isScreenshotCaptureSupported()) {
    throw new ScreenshotCaptureError(
      'Screenshot capture is unavailable in this browser. Please upload an image instead.',
      'unsupported'
    );
  }

  let stream: MediaStream | null = null;

  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;

    await video.play();
    await waitForVideoFrame(video);

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

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return await canvasToFile(canvas, `screenshot-${timestamp}.png`);
  } catch (error) {
    throw mapCaptureError(error);
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
  }
}
