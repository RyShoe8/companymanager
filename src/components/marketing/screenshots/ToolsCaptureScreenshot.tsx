'use client';

import MarketingScreenshotToolPreview from '@/components/marketing/screenshots/MarketingScreenshotToolPreview';
import MarketingRecordingToolPreview from '@/components/marketing/screenshots/MarketingRecordingToolPreview';

export default function ToolsCaptureScreenshot() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-background">
      <MarketingScreenshotToolPreview />
      <MarketingRecordingToolPreview />
    </div>
  );
}
