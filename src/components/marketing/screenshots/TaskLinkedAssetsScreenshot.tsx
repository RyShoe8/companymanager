'use client';

import MarketingPreviewShell from '@/components/marketing/screenshots/MarketingPreviewShell';
import MarketingProjectInspectorPreview from '@/components/marketing/screenshots/MarketingProjectInspectorPreview';
import MarketingLinkedAssetCallout from '@/components/marketing/screenshots/MarketingLinkedAssetCallout';
import { MARKETING_PROJECTS } from '@/lib/marketing/marketingFixtures';

export default function TaskLinkedAssetsScreenshot() {
  const project = MARKETING_PROJECTS[0];

  return (
    <MarketingPreviewShell
      phase="Build"
      lens="schedule"
      timeframe="weekly"
      inspectorLight
      showLensRow={false}
      minHeight="min-h-[400px]"
      bodyClassName="max-h-none overflow-visible"
    >
      <div className="space-y-4">
        <MarketingProjectInspectorPreview
          project={project}
          showTasks
          showLinkedAssets
        />
        <MarketingLinkedAssetCallout />
      </div>
    </MarketingPreviewShell>
  );
}
