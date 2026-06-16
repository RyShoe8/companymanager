'use client';

import ScheduleLens from '@/components/workspace/ScheduleLens';
import EmployeeSidebar from '@/components/planning-map/EmployeeSidebar';
import MarketingPreviewShell from '@/components/marketing/screenshots/MarketingPreviewShell';
import {
  MARKETING_CONTENT_ITEMS,
  MARKETING_EMPLOYEES,
  MARKETING_MEETINGS,
  MARKETING_REFERENCE_DATE,
  marketingActiveProjects,
  marketingProjectsForStage,
} from '@/lib/marketing/marketingFixtures';

const noop = () => {};
const noopAsync = async () => {};

export default function HeroWorkspaceScreenshot() {
  const projects = marketingProjectsForStage('Build');
  const allProjects = marketingActiveProjects();

  return (
    <MarketingPreviewShell phase="Build" lens="schedule" timeframe="weekly">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 min-w-0">
          <ScheduleLens
            projects={projects}
            contentItems={MARKETING_CONTENT_ITEMS}
            showTasks
            showContent
            contentChannelFilter="All"
            timeframe="weekly"
            currentDate={MARKETING_REFERENCE_DATE}
            onProjectClick={noop}
            onDateChange={noop}
            currentUserEmployeeName="Alex Chen"
            currentUserEmployeeId={MARKETING_EMPLOYEES[0]._id.toString()}
            currentUserId="marketing-user"
            isManagerOrAdmin
            showOnlyMyAssignments={false}
            onRefreshContent={noopAsync}
            onAddContent={noop}
            onContentItemClick={noop}
          />
        </div>
        <div className="xl:col-span-1 min-w-0 hidden sm:block">
          <EmployeeSidebar
            employees={MARKETING_EMPLOYEES}
            projects={projects}
            allProjects={allProjects}
            contentItems={MARKETING_CONTENT_ITEMS}
            meetings={MARKETING_MEETINGS}
            timeframe="weekly"
            currentDate={MARKETING_REFERENCE_DATE}
            currentUserRole="Administrator"
            currentUserEmployeeId={MARKETING_EMPLOYEES[0]._id.toString()}
          />
        </div>
      </div>
    </MarketingPreviewShell>
  );
}
