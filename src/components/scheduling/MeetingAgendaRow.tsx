'use client';

import Link from 'next/link';
import Button from '@/components/ui/Button';
import { IProject } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';

export type MeetingRow = {
  _id: string;
  title: string;
  start: string;
  end: string;
  agendaToken: string;
  linkedProjectIds: string[];
  attendeeEmployeeIds?: string[];
  externalAttendeeEmails?: string[];
  googleRecurringEventId?: string;
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
  isEditing: boolean;
  editProjectIds: string[];
  onToggleProject: (id: string) => void;
  onStartEdit: () => void;
  onSaveLinks: () => void;
}

export default function MeetingAgendaRow({
  meeting,
  employees,
  projects,
  isEditing,
  editProjectIds,
  onToggleProject,
  onStartEdit,
  onSaveLinks,
}: MeetingAgendaRowProps) {
  const start = new Date(meeting.start);
  const end = new Date(meeting.end);
  const inviteeLine = formatMeetingInvitees(meeting, employees);
  const linkedCount = meeting.linkedProjectIds?.length || 0;

  return (
    <div className="px-4 py-3 text-sm">
      <div className="flex items-start gap-3">
        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-background-elevated text-text-secondary flex-shrink-0">
          Meeting
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-text-primary">{meeting.title}</span>
            {meeting.googleRecurringEventId && (
              <span className="text-xs text-text-muted border border-border rounded px-1.5 py-0.5">
                Recurring
              </span>
            )}
            <span className="text-xs text-text-muted">{formatMeetingTimeRange(start, end)}</span>
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
        <div className="flex flex-wrap gap-2 shrink-0">
          {meeting.agendaToken && (
            <Link
              href={`/scheduling/agenda/${meeting.agendaToken}`}
              className="text-xs text-primary hover:text-primary-hover"
            >
              Open agenda
            </Link>
          )}
          <Button type="button" size="sm" variant="secondary" onClick={onStartEdit}>
            Link projects
          </Button>
        </div>
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
