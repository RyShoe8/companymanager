'use client';

import InlineClientView from '@/components/workspace/InlineClientView';
import MarketingPreviewShell from '@/components/marketing/screenshots/MarketingPreviewShell';
import { InspectorLightProvider } from '@/contexts/InspectorLightContext';
import {
  MARKETING_CONTENT_ITEMS,
  MARKETING_PROJECT_IDS,
  marketingClientProjects,
  marketingPrimaryClient,
} from '@/lib/marketing/marketingFixtures';

const noop = () => {};

export default function ClientsScreenshot() {
  const client = marketingPrimaryClient();
  const clientId = client._id!.toString();
  const projects = marketingClientProjects(clientId);
  const hubContentItems = MARKETING_CONTENT_ITEMS.filter(
    (item) => item.projectId?.toString() === MARKETING_PROJECT_IDS.northwindHub.toString()
  );

  return (
    <MarketingPreviewShell phase="Build" lens="clients" showLensRow minHeight="min-h-[480px]">
      <div className="inspector-light w-full max-w-[120rem] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 border border-border rounded-xl bg-white">
        <InspectorLightProvider>
          <InlineClientView
            client={client}
            projects={projects}
            allProjects={projects}
            contentItems={hubContentItems}
            onClose={noop}
            onViewProject={noop}
            onUpdateClient={noop}
            onRefresh={noop}
            employees={[]}
            isManagerOrAdmin
            currentUserId="marketing-preview-user"
          />
        </InspectorLightProvider>
      </div>
    </MarketingPreviewShell>
  );
}
