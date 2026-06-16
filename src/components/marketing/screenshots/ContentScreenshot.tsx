'use client';

import ScheduleLens from '@/components/workspace/ScheduleLens';
import MarketingPreviewShell from '@/components/marketing/screenshots/MarketingPreviewShell';
import {
  MARKETING_CONTENT_ITEMS,
  MARKETING_EMPLOYEES,
  MARKETING_REFERENCE_DATE,
  marketingProjectsForStage,
} from '@/lib/marketing/marketingFixtures';

const noop = () => {};
const noopAsync = async () => {};

export default function ContentScreenshot() {
  const projects = marketingProjectsForStage('Plan');

  return (
    <MarketingPreviewShell
      phase="Plan"
      lens="schedule"
      timeframe="weekly"
      showTasks={false}
      showContent
    >
      <ScheduleLens
        projects={projects}
        contentItems={MARKETING_CONTENT_ITEMS}
        showTasks={false}
        showContent
        contentChannelFilter="All"
        timeframe="weekly"
        currentDate={MARKETING_REFERENCE_DATE}
        onProjectClick={noop}
        onDateChange={noop}
        currentUserEmployeeName="Priya Patel"
        currentUserEmployeeId={MARKETING_EMPLOYEES[3]._id.toString()}
        currentUserId="marketing-user"
        isManagerOrAdmin
        showOnlyMyAssignments={false}
        onRefreshContent={noopAsync}
        onAddContent={noop}
        onContentItemClick={noop}
      />
    </MarketingPreviewShell>
  );
}
