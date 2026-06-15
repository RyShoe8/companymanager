'use client';

import Button from '@/components/ui/Button';
import {
  openMeetingPopout,
  MEETING_POPUP_BLOCKED_MESSAGE,
} from '@/lib/scheduling/openMeetingPopout';
import { IProject } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';
import type { MeetingJoinPlatform } from '@/lib/scheduling/extractMeetingJoinUrl';
import MeetingJoinCallButton from '@/components/scheduling/MeetingJoinCallButton';

export type MeetingRow = {
  _id: string;
  userId?: string;
  title: string;
  start: string;
  end: string;
  agendaToken: string;
  linkedProjectIds: string[];
  attendeeEmployeeIds?: string[];
  externalAttendeeEmails?: string[];
  googleRecurringEventId?: string;
  joinUrl?: string;
  joinPlatform?: MeetingJoinPlatform;
};

function formatMeetingInvitees(m: MeetingRow, employees: IEmployee[]): string | null {
  const names: string[] = [];
  for (const id of m.attendeeEmployeeIds || []) {
    const emp = employees.find((e) => e._id.toString() === id);
    if (emp) names.push(emp.name);
  }
  const external = m.externalAttendeeEmails?.length || 0;
  if (names.length === 0 && external === 0) return null;
  const parts: string[] = [];
  if (names.length > 0) parts.push(names.join(', '));
  if (external > 0) {
    parts.push(`${external} guest${external === 1 ? '' : 's'}`);
  }
  return `With: ${parts.join(' + ')}`;
}

function formatMeetingTimeRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${start.toLocaleTimeString(undefined, opts)} – ${end.toLocaleTimeString(undefined, opts)}`;
}

interface MeetingAgendaRowProps {
  meeting: MeetingRow;
  employees: IEmployee[];
  projects: IProject[];
  currentUserId?: string | null;
  isEditing: boolean;
  editProjectIds: string[];
  onToggleProject: (id: string) => void;
  onStartEdit: () => void;
  onSaveLinks: () => void;
  onEditMeeting?: () => void;
  onDeleteMeeting?: () => void;
  onPopoutBlocked?: () => void;
  variant?: 'default' | 'weekColumn';
}

export default function MeetingAgendaRow({
  meeting,
  employees,
  projects,
  currentUserId,
  isEditing,
  editProjectIds,
  onToggleProject,
  onStartEdit,
  onSaveLinks,
  onEditMeeting,
  onDeleteMeeting,
  onPopoutBlocked,
  variant = 'default',
}: MeetingAgendaRowProps) {
  const start = new Date(meeting.start);
  const end = new Date(meeting.end);
  const inviteeLine = formatMeetingInvitees(meeting, employees);
  const linkedCount = meeting.linkedProjectIds?.length || 0;
  const timeRange = formatMeetingTimeRange(start, end);
  const canManage = !!currentUserId && meeting.userId === currentUserId;

  const seriesControls = meeting.googleRecurringEventId ? (
    <span className="text-xs text-text-muted border border-border rounded px-1.5 py-0.5">
      Recurring
    </span>
  ) : null;

  const handleOpenMeeting = () => {
    const result = openMeetingPopout(meeting.agendaToken);
    if (result.blocked) {
      onPopoutBlocked?.();
    }
  };

  const actionButtons = (
    <>
      {meeting.joinUrl && (
        <MeetingJoinCallButton
          joinUrl={meeting.joinUrl}
          joinPlatform={meeting.joinPlatform}
          agendaToken={meeting.agendaToken}
          onPopoutBlocked={onPopoutBlocked}
          className={variant === 'weekColumn' ? 'w-full' : undefined}
        />
      )}
      {meeting.agendaToken && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className={variant === 'weekColumn' ? 'w-full justify-center text-xs' : undefined}
          onClick={handleOpenMeeting}
        >
          Open Meeting
        </Button>
      )}
      {canManage && onEditMeeting && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className={variant === 'weekColumn' ? 'w-full justify-center text-xs' : undefined}
          onClick={onEditMeeting}
        >
          Edit
        </Button>
      )}
      {canManage && onDeleteMeeting && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className={variant === 'weekColumn' ? 'w-full justify-center text-xs' : undefined}
          onClick={onDeleteMeeting}
        >
          Delete
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className={variant === 'weekColumn' ? 'w-full justify-center text-xs' : undefined}
        onClick={onStartEdit}
      >
        Link projects
      </Button>
    </>
  );

  if (variant === 'weekColumn') {
    const metaLine = [inviteeLine, linkedCount > 0 && !isEditing ? `${linkedCount} linked` : null]
      .filter(Boolean)
      .join(' · ');

    return (
      <div className="rounded-lg border border-border bg-background-card shadow-sm overflow-hidden min-w-0">
        <div className="p-3 text-sm min-w-0">
          <p className="text-xs font-medium text-text-primary truncate" title={timeRange}>
            {timeRange}
          </p>
          <p className="font-medium text-text-primary truncate mt-0.5" title={meeting.title}>
            {meeting.title}
          </p>
          {seriesControls && (
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">{seriesControls}</div>
          )}
          {metaLine ? (
            <p className="text-[11px] text-text-muted truncate mt-0.5" title={metaLine}>
              {metaLine}
            </p>
          ) : null}
          <div className="flex flex-col gap-1 mt-1.5 w-full min-w-0">{actionButtons}</div>
          {isEditing && (
            <div className="mt-2 pt-2 border-t border-border">
              <div className="flex flex-col gap-1.5 mb-2 max-h-28 overflow-y-auto">
                {projects.map((p) => (
                  <label
                    key={p._id.toString()}
                    className="flex items-center gap-1 text-xs text-text-secondary cursor-pointer min-w-0"
                  >
                    <input
                      type="checkbox"
                      checked={editProjectIds.includes(p._id.toString())}
                      onChange={() => onToggleProject(p._id.toString())}
                      className="rounded border-border shrink-0"
                    />
                    <span className="truncate">{p.name}</span>
                  </label>
                ))}
              </div>
              <Button type="button" size="sm" onClick={onSaveLinks} className="w-full justify-center">
                Save links
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 text-sm">
      <div className="flex items-start gap-3">
        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-background-elevated text-text-secondary flex-shrink-0">
          Meeting
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-text-primary">{meeting.title}</span>
            {seriesControls}
            <span className="text-xs text-text-muted">{timeRange}</span>
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            {start.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </p>
          {inviteeLine && <p className="text-xs text-text-muted mt-1">{inviteeLine}</p>}
          {linkedCount > 0 && !isEditing && (
            <p className="text-xs text-text-secondary mt-1">
              {linkedCount} linked project{linkedCount === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">{actionButtons}</div>
      </div>
      {isEditing && (
        <div className="mt-3 pt-3 border-t border-border ml-9">
          <div className="flex flex-wrap gap-2 mb-2 max-h-28 overflow-y-auto">
            {projects.map((p) => (
              <label
                key={p._id.toString()}
                className="flex items-center gap-1 text-xs text-text-secondary cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={editProjectIds.includes(p._id.toString())}
                  onChange={() => onToggleProject(p._id.toString())}
                  className="rounded border-border"
                />
                {p.name}
              </label>
            ))}
          </div>
          <Button type="button" size="sm" onClick={onSaveLinks}>
            Save links
          </Button>
        </div>
      )}
    </div>
  );
}

export { MEETING_POPUP_BLOCKED_MESSAGE };
