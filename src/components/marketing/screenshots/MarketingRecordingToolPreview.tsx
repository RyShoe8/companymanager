'use client';

import Button from '@/components/ui/Button';

export default function MarketingRecordingToolPreview() {
  return (
    <div className="rounded-xl border border-border bg-background-card p-5 space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">Screen recording</h3>
      <p className="text-sm text-text-secondary">
        Record your screen with system or microphone audio, or upload a video.
      </p>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-primary">Audio source</legend>
        <label className="flex items-start gap-2 text-sm text-text-secondary">
          <input type="radio" name="marketing-recording-audio" className="mt-1" defaultChecked readOnly />
          <span>
            <span className="font-medium text-text-primary">System audio</span>
            <span className="block text-xs text-text-muted mt-0.5">
              Captures sound from the tab or window you share.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-text-secondary">
          <input type="radio" name="marketing-recording-audio" className="mt-1" readOnly />
          <span>
            <span className="font-medium text-text-primary">Microphone</span>
            <span className="block text-xs text-text-muted mt-0.5">
              Records your voice while you present.
            </span>
          </span>
        </label>
      </fieldset>
      <Button type="button" size="sm" tabIndex={-1}>
        Share screen
      </Button>
    </div>
  );
}
