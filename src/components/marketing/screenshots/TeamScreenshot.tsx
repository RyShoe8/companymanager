'use client';

import EmployeeSidebar from '@/components/planning-map/EmployeeSidebar';
import MarketingPreviewShell from '@/components/marketing/screenshots/MarketingPreviewShell';
import {
  MARKETING_CONTENT_ITEMS,
  MARKETING_EMPLOYEES,
  MARKETING_MEETINGS,
  MARKETING_REFERENCE_DATE,
  marketingActiveProjects,
} from '@/lib/marketing/marketingFixtures';

export default function TeamScreenshot() {
  const projects = marketingActiveProjects();

  return (
    <MarketingPreviewShell phase="Build" lens="capacity" timeframe="weekly" showLensRow={false}>
      <div className="max-w-4xl mx-auto">
        <EmployeeSidebar
          employees={MARKETING_EMPLOYEES}
          projects={projects}
          allProjects={projects}
          contentItems={MARKETING_CONTENT_ITEMS}
          meetings={MARKETING_MEETINGS}
          timeframe="weekly"
          currentDate={MARKETING_REFERENCE_DATE}
          currentUserRole="Administrator"
          currentUserEmployeeId={MARKETING_EMPLOYEES[0]._id.toString()}
        />
      </div>
    </MarketingPreviewShell>
  );
}
