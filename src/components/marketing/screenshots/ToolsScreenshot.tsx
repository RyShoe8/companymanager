'use client';

import MarketingPreviewShell from '@/components/marketing/screenshots/MarketingPreviewShell';
import MarketingProjectInspectorPreview from '@/components/marketing/screenshots/MarketingProjectInspectorPreview';
import { MARKETING_PROJECTS } from '@/lib/marketing/marketingFixtures';

export default function ToolsScreenshot() {
  const project = MARKETING_PROJECTS[0];

  return (
    <MarketingPreviewShell
      phase="Build"
      lens="schedule"
      timeframe="weekly"
      inspectorLight
      showLensRow={false}
      minHeight="min-h-[300px]"
    >
      <MarketingProjectInspectorPreview
        project={project}
        showCreateMenu
        showTasks={false}
      />
    </MarketingPreviewShell>
  );
}
