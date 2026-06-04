'use client';

import { createPortal } from 'react-dom';
import Button from '@/components/ui/Button';

interface RecordingStatusBannerProps {
  message: string;
  variant: 'progress' | 'error';
  onDismiss?: () => void;
}

export default function RecordingStatusBanner({
  message,
  variant,
  onDismiss,
}: RecordingStatusBannerProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 max-w-md w-[calc(100%-2rem)]">
      <div
        className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${
          variant === 'error'
            ? 'border-error/30 bg-background-elevated'
            : 'border-border bg-background-elevated'
        }`}
        role={variant === 'error' ? 'alert' : 'status'}
      >
        {variant === 'progress' && (
          <span
            className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-primary"
            aria-hidden
          />
        )}
        <p
          className={`flex-1 text-sm ${
            variant === 'error' ? 'text-error' : 'text-text-primary'
          }`}
        >
          {message}
        </p>
        {variant === 'error' && onDismiss && (
          <Button type="button" size="sm" variant="secondary" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>
    </div>,
    document.body
  );
}
