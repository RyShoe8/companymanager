'use client';

import { useState } from 'react';
import MeetingsCalendarView from '@/components/scheduling/MeetingsCalendarView';
import EmployeeSidebar from '@/components/planning-map/EmployeeSidebar';
import MarketingPreviewShell from '@/components/marketing/screenshots/MarketingPreviewShell';
import {
  MARKETING_CONTENT_ITEMS,
  MARKETING_EMPLOYEES,
  MARKETING_MEETINGS,
  MARKETING_REFERENCE_DATE,
  marketingActiveProjects,
} from '@/lib/marketing/marketingFixtures';

const noop = () => {};

export default function MeetingsScreenshot() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProjectIds, setEditProjectIds] = useState<string[]>([]);
  const projects = marketingActiveProjects();

  return (
    <MarketingPreviewShell phase="Schedule" timeframe="weekly" showLensRow={false}>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 min-w-0">
          <MeetingsCalendarView
            meetings={MARKETING_MEETINGS}
            timeframe="weekly"
            currentDate={MARKETING_REFERENCE_DATE}
            onDateChange={noop}
            projects={projects}
            employees={MARKETING_EMPLOYEES}
            editingId={editingId}
            editProjectIds={editProjectIds}
            onToggleProject={(id) =>
              setEditProjectIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
              )
            }
            onStartEdit={(meetingId, linkedProjectIds) => {
              setEditingId(meetingId);
              setEditProjectIds(linkedProjectIds);
            }}
            onSaveLinks={() => setEditingId(null)}
            onNewMeeting={noop}
            currentUserId="marketing-user"
          />
        </div>
        <div className="xl:col-span-1 min-w-0 hidden sm:block">
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
      </div>
    </MarketingPreviewShell>
  );
}
