'use client';

import { createPortal } from 'react-dom';
import Button from '@/components/ui/Button';

interface RecordingOverlayProps {
  elapsedLabel: string;
  onStop: () => void;
}

export default function RecordingOverlay({ elapsedLabel, onStop }: RecordingOverlayProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border border-border bg-background-elevated px-4 py-2 shadow-lg">
        <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-error" aria-hidden />
          Recording
        </span>
        <span className="font-mono text-sm text-text-secondary tabular-nums">{elapsedLabel}</span>
        <Button type="button" size="sm" onClick={onStop}>
          Stop
        </Button>
      </div>
    </div>,
    document.body
  );
}
