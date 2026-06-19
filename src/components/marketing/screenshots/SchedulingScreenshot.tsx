'use client';

import { useState } from 'react';
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProjectIds, setEditProjectIds] = useState<string[]>([]);
  const [editClientIds, setEditClientIds] = useState<string[]>([]);
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
        editingId={editingId}
        editProjectIds={editProjectIds}
        editClientIds={editClientIds}
        onToggleProject={(id) =>
          setEditProjectIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
          )
        }
        onToggleClient={(id) =>
          setEditClientIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
          )
        }
        onStartEdit={(meetingId, linkedProjectIds, linkedClientIds) => {
          setEditingId(meetingId);
          setEditProjectIds(linkedProjectIds);
          setEditClientIds(linkedClientIds);
        }}
        onSaveLinks={() => setEditingId(null)}
        onNewMeeting={noop}
        currentUserId="marketing-user"
      />
    </MarketingPreviewShell>
  );
}
