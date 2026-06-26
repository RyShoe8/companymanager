export type CaptureMode = 'screen' | 'camera' | 'upload-only';

export function isTouchMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(pointer: coarse)')?.matches) return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function isCameraCaptureSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  );
}

export function hasScreenCaptureApi(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function'
  );
}

export function getScreenshotCaptureMode(): CaptureMode {
  if (hasScreenCaptureApi()) return 'screen';
  if (isCameraCaptureSupported()) return 'camera';
  return 'upload-only';
}

export function getRecordingCaptureMode(): CaptureMode {
  if (hasScreenCaptureApi() && typeof MediaRecorder !== 'undefined') return 'screen';
  if (isCameraCaptureSupported() && typeof MediaRecorder !== 'undefined') return 'camera';
  return 'upload-only';
}
