import { describe, expect, it } from 'vitest';
import { formatMicPermissionError, recordingAudioWarning } from '@/lib/captureRecording';

describe('captureRecording helpers', () => {
  describe('recordingAudioWarning', () => {
    it('returns null when audio was included', () => {
      expect(recordingAudioWarning('mic', true)).toBeNull();
      expect(recordingAudioWarning('system', true)).toBeNull();
    });

    it('warns about system audio when missing', () => {
      expect(recordingAudioWarning('system', false)).toMatch(/System audio/);
    });

    it('warns about microphone when missing', () => {
      expect(recordingAudioWarning('mic', false)).toMatch(/Voice audio was not captured/);
    });
  });

  describe('formatMicPermissionError', () => {
    it('maps NotAllowedError to site settings guidance', () => {
      const error = new DOMException('denied', 'NotAllowedError');
      expect(formatMicPermissionError(error)).toMatch(/site settings/i);
    });

    it('maps NotFoundError to no device message', () => {
      const error = new DOMException('not found', 'NotFoundError');
      expect(formatMicPermissionError(error)).toMatch(/No microphone detected/);
    });

    it('maps NotReadableError to device in use message', () => {
      const error = new DOMException('not readable', 'NotReadableError');
      expect(formatMicPermissionError(error)).toMatch(/in use by another app/);
    });

    it('falls back for unknown errors', () => {
      expect(formatMicPermissionError(new Error('unknown'))).toMatch(/Microphone access failed/);
    });
  });
});
