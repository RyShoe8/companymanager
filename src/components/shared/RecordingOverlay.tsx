'use client';

import { createPortal } from 'react-dom';
import Button from '@/components/ui/Button';
import type { RecordingPopoutPhase } from '@/lib/recordings/recordingPopoutSync';

interface RecordingOverlayProps {
  phase: RecordingPopoutPhase;
  elapsedLabel: string;
  onStart: () => void;
  onStop: () => void;
}

export default function RecordingOverlay({
  phase,
  elapsedLabel,
  onStart,
  onStop,
}: RecordingOverlayProps) {
  if (typeof document === 'undefined') return null;

  const isRecording = phase === 'recording';

  return createPortal(
    <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border border-border bg-background-elevated px-4 py-2 shadow-lg">
        <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
          {isRecording && (
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-error" aria-hidden />
          )}
          {isRecording ? 'Recording' : 'Ready'}
        </span>
        <span className="font-mono text-sm text-text-secondary tabular-nums">{elapsedLabel}</span>
        <Button type="button" size="sm" onClick={isRecording ? onStop : onStart}>
          {isRecording ? 'Stop' : 'Start'}
        </Button>
      </div>
    </div>,
    document.body
  );
}
