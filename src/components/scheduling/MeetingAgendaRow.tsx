'use client';

import Button from '@/components/ui/Button';
import {
  openMeetingPopout,
  MEETING_POPUP_BLOCKED_MESSAGE,
} from '@/lib/scheduling/openMeetingPopout';
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
  linkedClientIds?: string[];
  attendeeEmployeeIds?: string[];
  externalAttendeeEmails?: string[];
  googleRecurringEventId?: string;
  joinUrl?: string;
  joinPlatform?: MeetingJoinPlatform;
  description?: string;
};

function formatMeetingTimeRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${start.toLocaleTimeString(undefined, opts)} – ${end.toLocaleTimeString(undefined, opts)}`;
}

function formatLinkedSummary(clientCount: number, projectCount: number): string | null {
  const parts: string[] = [];
  if (clientCount > 0) {
    parts.push(`${clientCount} client${clientCount === 1 ? '' : 's'}`);
  }
  if (projectCount > 0) {
    parts.push(`${projectCount} project${projectCount === 1 ? '' : 's'}`);
  }
  return parts.length > 0 ? parts.join(', ') + ' linked' : null;
}

interface MeetingGuestsListProps {
  meeting: MeetingRow;
  employees: IEmployee[];
  compact?: boolean;
}

function MeetingGuestsList({ meeting, employees, compact = false }: MeetingGuestsListProps) {
  const teamNames: string[] = [];
  for (const id of meeting.attendeeEmployeeIds || []) {
    const emp = employees.find((e) => e._id.toString() === id);
    if (emp) teamNames.push(emp.name);
  }
  const guestEmails = meeting.externalAttendeeEmails || [];

  if (teamNames.length === 0 && guestEmails.length === 0) return null;

  const textClass = compact ? 'text-[11px] text-text-muted' : 'text-xs text-text-muted';

  return (
    <div className={`${textClass} mt-1 space-y-0.5`}>
      {teamNames.length > 0 && (
        <p>
          <span className="font-medium text-text-secondary">Team:</span>{' '}
          {teamNames.join(', ')}
        </p>
      )}
      {guestEmails.length > 0 && (
        <p className={compact ? 'truncate' : undefined} title={guestEmails.join(', ')}>
          <span className="font-medium text-text-secondary">Guests:</span>{' '}
          {guestEmails.join(', ')}
        </p>
      )}
    </div>
  );
}

interface MeetingAgendaRowProps {
  meeting: MeetingRow;
  employees: IEmployee[];
  currentUserId?: string | null;
  onStartEdit: () => void;
  onEditMeeting?: () => void;
  onDeleteMeeting?: () => void;
  onPopoutBlocked?: () => void;
  variant?: 'default' | 'weekColumn';
}

export default function MeetingAgendaRow({
  meeting,
  employees,
  currentUserId,
  onStartEdit,
  onEditMeeting,
  onDeleteMeeting,
  onPopoutBlocked,
  variant = 'default',
}: MeetingAgendaRowProps) {
  const start = new Date(meeting.start);
  const end = new Date(meeting.end);
  const clientCount = meeting.linkedClientIds?.length || 0;
  const projectCount = meeting.linkedProjectIds?.length || 0;
  const linkedSummary = formatLinkedSummary(clientCount, projectCount);
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

  const linkButton = (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className={variant === 'weekColumn' ? 'w-full justify-center text-xs' : 'w-full justify-center whitespace-nowrap sm:w-auto'}
      onClick={onStartEdit}
    >
      Link clients & projects
    </Button>
  );

  if (variant === 'weekColumn') {
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
          <MeetingGuestsList meeting={meeting} employees={employees} compact />
          {linkedSummary ? (
            <p className="text-[11px] text-text-muted truncate mt-0.5" title={linkedSummary}>
              {linkedSummary}
            </p>
          ) : null}
          <div className="flex flex-col gap-1 mt-1.5 w-full min-w-0">
            {meeting.joinUrl && (
              <MeetingJoinCallButton
                joinUrl={meeting.joinUrl}
                joinPlatform={meeting.joinPlatform}
                agendaToken={meeting.agendaToken}
                onPopoutBlocked={onPopoutBlocked}
                className="w-full"
              />
            )}
            {meeting.agendaToken && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full justify-center text-xs"
                onClick={handleOpenMeeting}
              >
                Open Meeting
              </Button>
            )}
            {canManage && onEditMeeting && (
              <Button type="button" size="sm" variant="secondary" className="w-full justify-center text-xs" onClick={onEditMeeting}>
                Edit
              </Button>
            )}
            {canManage && onDeleteMeeting && (
              <Button type="button" size="sm" variant="secondary" className="w-full justify-center text-xs" onClick={onDeleteMeeting}>
                Delete
              </Button>
            )}
            {linkButton}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
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
            <MeetingGuestsList meeting={meeting} employees={employees} />
            {linkedSummary && (
              <p className="text-xs text-text-secondary mt-1">{linkedSummary}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:flex-wrap sm:shrink-0">
          {meeting.joinUrl && (
            <MeetingJoinCallButton
              joinUrl={meeting.joinUrl}
              joinPlatform={meeting.joinPlatform}
              agendaToken={meeting.agendaToken}
              onPopoutBlocked={onPopoutBlocked}
              className="w-full justify-center sm:w-auto"
            />
          )}
          {meeting.agendaToken && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full justify-center whitespace-nowrap sm:w-auto"
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
              className="w-full justify-center whitespace-nowrap sm:w-auto"
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
              className="w-full justify-center whitespace-nowrap sm:w-auto"
              onClick={onDeleteMeeting}
            >
              Delete
            </Button>
          )}
          {linkButton}
        </div>
      </div>
    </div>
  );
}

export { MEETING_POPUP_BLOCKED_MESSAGE };
