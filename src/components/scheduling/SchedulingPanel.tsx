'use client';

import { useEffect, useState } from 'react';
import type { IMeeting } from '@/lib/models/Meeting';
import { IProject } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';
import CreateMeetingModal, { type MeetingCreateSuccessInfo } from '@/components/scheduling/CreateMeetingModal';
import MeetingsCalendarView from '@/components/scheduling/MeetingsCalendarView';
import type { TimeframeType } from '@/lib/utils/dateUtils';

interface SchedulingPanelProps {
  projects: IProject[];
  employees?: IEmployee[];
  currentUserEmployeeId?: string | null;
  meetings: IMeeting[];
  loadingMeetings?: boolean;
  meetingRefreshKey?: number;
  timeframe: TimeframeType;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onRefreshMeetings: () => void;
  schedulingTimeZone: string;
  externalMessage?: string | null;
  onClearExternalMessage?: () => void;
  onSetMessage?: (message: string) => void;
}

export default function SchedulingPanel({
  projects,
  employees = [],
  currentUserEmployeeId,
  meetings,
  loadingMeetings = false,
  meetingRefreshKey = 0,
  timeframe,
  currentDate,
  onDateChange,
  onRefreshMeetings,
  schedulingTimeZone,
  externalMessage,
  onClearExternalMessage,
  onSetMessage,
}: SchedulingPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProjectIds, setEditProjectIds] = useState<string[]>([]);

  const displayMessage = externalMessage ?? message;

  useEffect(() => {
    if (meetingRefreshKey > 0) {
      const msg = 'Meeting created.';
      setMessage(msg);
      onSetMessage?.(msg);
    }
  }, [meetingRefreshKey, onSetMessage]);

  const handleSaveMeetingProjects = async (meetingId: string) => {
    const editingMeeting = meetings.find((m) => m._id.toString() === meetingId);
    const res = await fetch(`/api/scheduling/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedProjectIds: editProjectIds }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setEditingId(null);
      onRefreshMeetings();
      const participants =
        typeof data.participantsUpdatedCount === 'number' ? data.participantsUpdatedCount : 1;
      const calendars =
        typeof data.calendarsPatchedCount === 'number' ? data.calendarsPatchedCount : 0;
      let msg = 'Meeting projects updated.';
      if (editingMeeting?.googleRecurringEventId && participants > 1) {
        msg = `Projects linked across ${participants} meeting records${calendars > 0 ? `; ${calendars} Google Calendar${calendars === 1 ? '' : 's'} updated with agenda` : ''}.`;
      } else if (participants > 1) {
        msg = `Projects linked for ${participants} team members${calendars > 0 ? `; ${calendars} calendar${calendars === 1 ? '' : 's'} updated` : ' in Nucleas'}.`;
      } else if (calendars > 0) {
        msg = 'Meeting projects updated; agenda refreshed in your Google Calendar.';
      }
      setMessage(msg);
      onSetMessage?.(msg);
    } else {
      const err = data.error || 'Failed to update meeting.';
      setMessage(err);
      onSetMessage?.(err);
    }
  };

  const toggleEditProject = (id: string) => {
    setEditProjectIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleMeetingCreated = async (info?: MeetingCreateSuccessInfo) => {
    onRefreshMeetings();
    let msg = 'Meeting created.';
    if (info?.invitesSent && info.invitesSent > 0) {
      msg += ` ${info.invitesSent} calendar invite${info.invitesSent === 1 ? '' : 's'} sent.`;
    }
    if (info?.skippedAttendees?.length) {
      msg += ` ${info.skippedAttendees.length} could not be invited (missing email).`;
    }
    setMessage(msg);
    onSetMessage?.(msg);
  };

  if (loadingMeetings) {
    return <div className="text-text-secondary py-12 text-center">Loading meetings…</div>;
  }

  return (
    <div className="space-y-4">
      {displayMessage && (
        <div className="rounded-lg border border-border bg-background-card px-4 py-2 text-sm text-text-primary flex items-center justify-between gap-2">
          <span>{displayMessage}</span>
          <button
            type="button"
            className="text-text-muted hover:text-text-primary text-xs shrink-0"
            onClick={() => {
              setMessage(null);
              onClearExternalMessage?.();
            }}
            aria-label="Dismiss message"
          >
            Dismiss
          </button>
        </div>
      )}

      <CreateMeetingModal
        isOpen={showMeetingModal}
        onClose={() => setShowMeetingModal(false)}
        projects={projects}
        employees={employees}
        currentUserEmployeeId={currentUserEmployeeId}
        schedulingTimeZone={schedulingTimeZone}
        onSuccess={handleMeetingCreated}
      />

      <MeetingsCalendarView
        meetings={meetings}
        timeframe={timeframe}
        currentDate={currentDate}
        onDateChange={onDateChange}
        projects={projects}
        employees={employees}
        editingId={editingId}
        editProjectIds={editProjectIds}
        onToggleProject={toggleEditProject}
        onStartEdit={(meetingId, linkedIds) => {
          setEditingId(meetingId);
          setEditProjectIds(linkedIds);
        }}
        onSaveLinks={(meetingId) => void handleSaveMeetingProjects(meetingId)}
        onNewMeeting={() => setShowMeetingModal(true)}
      />
    </div>
  );
}
