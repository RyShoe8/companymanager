'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { IProject } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import CreateMeetingModal, { type MeetingCreateSuccessInfo } from '@/components/scheduling/CreateMeetingModal';
import MeetingAgendaRow, { type MeetingRow } from '@/components/scheduling/MeetingAgendaRow';
import { addDays, buildMeetingsRangeQuery, startOfWeek } from '@/hooks/scheduling/useSchedulingCalendar';

interface SchedulingPanelProps {
  projects: IProject[];
  employees?: IEmployee[];
  currentUserEmployeeId?: string | null;
  meetingRefreshKey?: number;
  weekStart: Date;
  onWeekStartChange: (weekStart: Date) => void;
  schedulingTimeZone: string;
  externalMessage?: string | null;
  onClearExternalMessage?: () => void;
  onSetMessage?: (message: string) => void;
}

export default function SchedulingPanel({
  projects,
  employees = [],
  currentUserEmployeeId,
  meetingRefreshKey = 0,
  weekStart,
  onWeekStartChange,
  schedulingTimeZone,
  externalMessage,
  onClearExternalMessage,
  onSetMessage,
}: SchedulingPanelProps) {
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProjectIds, setEditProjectIds] = useState<string[]>([]);

  const rangeQuery = useMemo(() => buildMeetingsRangeQuery(weekStart), [weekStart]);

  const displayMessage = externalMessage ?? message;

  const loadMeetings = useCallback(async () => {
    const res = await fetch(`/api/scheduling/meetings?${rangeQuery}`);
    if (res.ok) setMeetings(await res.json());
  }, [rangeQuery]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadMeetings();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMeetings]);

  useEffect(() => {
    if (meetingRefreshKey > 0) {
      loadMeetings();
      const msg = 'Meeting created.';
      setMessage(msg);
      onSetMessage?.(msg);
    }
  }, [meetingRefreshKey, loadMeetings, onSetMessage]);

  const handleSaveMeetingProjects = async (meetingId: string) => {
    const editingMeeting = meetings.find((m) => m._id === meetingId);
    const res = await fetch(`/api/scheduling/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedProjectIds: editProjectIds }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setEditingId(null);
      await loadMeetings();
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
    await loadMeetings();
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

  if (loading) {
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

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Meetings</h2>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onWeekStartChange(addDays(weekStart, -7))}
            >
              Prev week
            </Button>
            <span className="text-text-secondary">
              {weekStart.toLocaleDateString()} – {addDays(weekStart, 6).toLocaleDateString()}
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onWeekStartChange(addDays(weekStart, 7))}
            >
              Next week
            </Button>
            <Button type="button" size="sm" onClick={() => setShowMeetingModal(true)}>
              New meeting
            </Button>
          </div>
        </div>

        {meetings.length === 0 ? (
          <p className="text-sm text-text-secondary px-4 py-8 text-center">
            No meetings this week. Sync your calendar or create one.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {meetings.map((m) => (
              <MeetingAgendaRow
                key={m._id}
                meeting={m}
                employees={employees}
                projects={projects}
                isEditing={editingId === m._id}
                editProjectIds={editProjectIds}
                onToggleProject={toggleEditProject}
                onStartEdit={() => {
                  setEditingId(m._id);
                  setEditProjectIds(m.linkedProjectIds || []);
                }}
                onSaveLinks={() => void handleSaveMeetingProjects(m._id)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export { startOfWeek };
