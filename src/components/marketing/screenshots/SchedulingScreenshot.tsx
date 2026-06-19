'use client';

import MeetingsCalendarView from '@/components/scheduling/MeetingsCalendarView';
import MarketingPreviewShell from '@/components/marketing/screenshots/MarketingPreviewShell';
import {
  MARKETING_CLIENTS,
  MARKETING_EMPLOYEES,
  MARKETING_MEETINGS,
  MARKETING_REFERENCE_DATE,
  marketingActiveProjects,
} from '@/lib/marketing/marketingFixtures';

const noop = () => {};

export default function SchedulingScreenshot() {
  const projects = marketingActiveProjects();

  return (
    <MarketingPreviewShell
      phase="Schedule"
      timeframe="today"
      showLensRow={false}
      minHeight="min-h-[440px]"
      bodyClassName="max-h-none overflow-visible"
    >
      <MeetingsCalendarView
        meetings={MARKETING_MEETINGS}
        timeframe="today"
        currentDate={MARKETING_REFERENCE_DATE}
        onDateChange={noop}
        projects={projects}
        clients={MARKETING_CLIENTS}
        employees={MARKETING_EMPLOYEES}
        isManagerOrAdmin
        onStartEdit={noop}
        onNewMeeting={noop}
        currentUserId="marketing-user"
      />
    </MarketingPreviewShell>
  );
}
