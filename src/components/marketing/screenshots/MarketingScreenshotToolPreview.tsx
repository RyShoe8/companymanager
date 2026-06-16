'use client';

import Button from '@/components/ui/Button';

export default function MarketingScreenshotToolPreview() {
  return (
    <div className="rounded-xl border border-border bg-background-card p-5 space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">Screenshot capture</h3>
      <p className="text-sm text-text-secondary">
        Choose how to capture, then pick a tab or window in your browser&apos;s share dialog.
      </p>
      <div className="flex flex-col gap-2">
        <Button type="button" size="sm" tabIndex={-1}>
          Capture full window
        </Button>
        <Button type="button" variant="secondary" size="sm" tabIndex={-1}>
          Select area
        </Button>
        <Button type="button" variant="secondary" size="sm" tabIndex={-1}>
          Upload file
        </Button>
      </div>
    </div>
  );
}
