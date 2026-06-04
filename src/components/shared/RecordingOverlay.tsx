'use client';

import { createPortal } from 'react-dom';
import Button from '@/components/ui/Button';
import type { RecordingPopoutPhase } from '@/lib/recordings/recordingPopoutSync';

interface RecordingOverlayProps {
  phase: RecordingPopoutPhase;
  elapsedLabel: string;
  stabilizeSecondsRemaining?: number;
  onStart: () => void;
  onStop: () => void;
  onSkipStabilization?: () => void;
}

export default function RecordingOverlay({
  phase,
  elapsedLabel,
  stabilizeSecondsRemaining = 0,
  onStart,
  onStop,
  onSkipStabilization,
}: RecordingOverlayProps) {
  if (typeof document === 'undefined') return null;

  const isRecording = phase === 'recording';
  const isStabilizing = phase === 'stabilizing';

  return createPortal(
    <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 max-w-md w-[calc(100%-2rem)]">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-background-elevated px-4 py-3 shadow-lg">
        {isStabilizing && (
          <p className="text-xs text-text-muted">
            Let the shared window reach full quality — streaming video often dips for ~15s after
            share. Wait until HBO, Netflix, etc. look sharp before recording.
          </p>
        )}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-text-primary shrink-0">
            {isRecording && (
              <span
                className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-error"
                aria-hidden
              />
            )}
            {isStabilizing
              ? `Stabilizing… ${stabilizeSecondsRemaining}s`
              : isRecording
                ? 'Recording'
                : 'Ready'}
          </span>
          {!isStabilizing && (
            <span className="font-mono text-sm text-text-secondary tabular-nums flex-1 text-center">
              {elapsedLabel}
            </span>
          )}
          {isStabilizing ? (
            <Button type="button" size="sm" onClick={onSkipStabilization}>
              Ready to record
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={isRecording ? onStop : onStart}>
              {isRecording ? 'Stop' : 'Start'}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
