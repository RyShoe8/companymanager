'use client';

import ClientDetailDashboard from '@/components/workspace/ClientDetailDashboard';
import MarketingPreviewShell from '@/components/marketing/screenshots/MarketingPreviewShell';
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
      <ClientDetailDashboard
        client={client}
        projects={projects}
        contentItems={hubContentItems}
        onBack={noop}
        onViewProject={noop}
        isManagerOrAdmin
        currentUserId="marketing-preview-user"
      />
    </MarketingPreviewShell>
  );
}
