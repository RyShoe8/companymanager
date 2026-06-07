'use client';

import { useEffect, useMemo, useState } from 'react';
import { IProject } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { RecurrenceEnd, RecurrencePreset } from '@/lib/scheduling/recurrence';
import { validateRecurrenceInput } from '@/lib/scheduling/recurrence';
import RecurrenceFields from '@/components/shared/RecurrenceFields';
import { formInputClass } from '@/components/ui/formClasses';
import type { MeetingVideoMode } from '@/lib/scheduling/meetingVideoConference';
import { inferVideoModeFromMeeting } from '@/lib/scheduling/meetingVideoConference';
import type { MeetingJoinPlatform } from '@/lib/scheduling/extractMeetingJoinUrl';

export type MeetingCreateSuccessInfo = {
  invitesSent?: number;
  skippedAttendees?: { name: string; reason: string }[];
};

export type MeetingFormMeeting = {
  _id: string;
  title: string;
  start: string;
  end: string;
  linkedProjectIds: string[];
  attendeeEmployeeIds?: string[];
  externalAttendeeEmails?: string[];
  googleRecurringEventId?: string;
  joinUrl?: string;
  joinPlatform?: MeetingJoinPlatform;
};

export type MeetingUpdateScope = 'instance' | 'series';

interface MeetingFormModalProps {
  mode: 'create' | 'edit';
  isOpen: boolean;
  onClose: () => void;
  projects: IProject[];
  employees: IEmployee[];
  currentUserEmployeeId?: string | null;
  schedulingTimeZone?: string;
  meeting?: MeetingFormMeeting | null;
  onSuccess?: (info?: MeetingCreateSuccessInfo) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function employeeHasInviteEmail(emp: IEmployee): boolean {
  return !!(emp.email?.trim() || emp.userId);
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MeetingFormModal({
  mode,
  isOpen,
  onClose,
  projects,
  employees,
  currentUserEmployeeId,
  schedulingTimeZone,
  meeting,
  onSuccess,
}: MeetingFormModalProps) {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [repeatPreset, setRepeatPreset] = useState<RecurrencePreset>('none');
  const [recurrenceEnd, setRecurrenceEnd] = useState<RecurrenceEnd>('never');
  const [recurrenceUntil, setRecurrenceUntil] = useState('');
  const [recurrenceCount, setRecurrenceCount] = useState('10');
  const [linkedProjectIds, setLinkedProjectIds] = useState<string[]>([]);
  const [attendeeEmployeeIds, setAttendeeEmployeeIds] = useState<string[]>([]);
  const [externalEmails, setExternalEmails] = useState<string[]>([]);
  const [externalEmailInput, setExternalEmailInput] = useState('');
  const [videoMode, setVideoMode] = useState<MeetingVideoMode>('none');
  const [manualJoinUrl, setManualJoinUrl] = useState('');
  const [editScope, setEditScope] = useState<MeetingUpdateScope>('instance');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRecurringEdit = mode === 'edit' && !!meeting?.googleRecurringEventId;

  const inviteableEmployees = useMemo(
    () =>
      employees.filter(
        (e) =>
          e._id.toString() !== currentUserEmployeeId &&
          employeeHasInviteEmail(e)
      ),
    [employees, currentUserEmployeeId]
  );

  const employeesWithoutEmail = useMemo(
    () =>
      employees.filter(
        (e) =>
          e._id.toString() !== currentUserEmployeeId &&
          !employeeHasInviteEmail(e)
      ),
    [employees, currentUserEmployeeId]
  );

  useEffect(() => {
    if (!isOpen) return;

    if (mode === 'edit' && meeting) {
      setTitle(meeting.title);
      setStart(toDatetimeLocal(meeting.start));
      setEnd(toDatetimeLocal(meeting.end));
      setLinkedProjectIds(meeting.linkedProjectIds || []);
      setAttendeeEmployeeIds(meeting.attendeeEmployeeIds || []);
      setExternalEmails(meeting.externalAttendeeEmails || []);
      const inferred = inferVideoModeFromMeeting(meeting);
      setVideoMode(inferred);
      setManualJoinUrl(inferred === 'manual' ? meeting.joinUrl || '' : '');
      setEditScope('instance');
      setRepeatPreset('none');
    } else {
      setTitle('');
      setStart('');
      setEnd('');
      setRepeatPreset('none');
      setRecurrenceEnd('never');
      setRecurrenceUntil('');
      setRecurrenceCount('10');
      setLinkedProjectIds([]);
      setAttendeeEmployeeIds([]);
      setExternalEmails([]);
      setVideoMode('none');
      setManualJoinUrl('');
    }

    setExternalEmailInput('');
    setError(null);
  }, [isOpen, mode, meeting]);

  const toggleProject = (id: string) => {
    setLinkedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleAttendee = (id: string) => {
    setAttendeeEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const addExternalEmail = () => {
    const email = externalEmailInput.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_RE.test(email)) {
      setError('Enter a valid email address for external guests.');
      return;
    }
    if (externalEmails.includes(email)) {
      setExternalEmailInput('');
      return;
    }
    setExternalEmails((prev) => [...prev, email]);
    setExternalEmailInput('');
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !start || !end) {
      setError('Title, start, and end are required.');
      return;
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate) {
      setError('End must be after start.');
      return;
    }

    if (videoMode === 'manual' && !manualJoinUrl.trim()) {
      setError('Enter a video conference link or choose another option.');
      return;
    }

    if (mode === 'create') {
      let untilIso: string | undefined;
      if (repeatPreset !== 'none' && recurrenceEnd === 'on') {
        if (!recurrenceUntil) {
          setError('Choose an end date for the series.');
          return;
        }
        untilIso = new Date(`${recurrenceUntil}T23:59:59`).toISOString();
      }

      const countNum =
        repeatPreset !== 'none' && recurrenceEnd === 'after'
          ? parseInt(recurrenceCount, 10)
          : undefined;

      if (repeatPreset !== 'none') {
        const validationErr = validateRecurrenceInput({
          preset: repeatPreset,
          start: startDate,
          end: recurrenceEnd,
          until: untilIso ? new Date(untilIso) : undefined,
          count: countNum,
        });
        if (validationErr) {
          setError(validationErr);
          return;
        }
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'edit' && meeting) {
        const body: Record<string, unknown> = {
          title: title.trim(),
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          linkedProjectIds,
          attendeeEmployeeIds,
          externalAttendeeEmails: externalEmails,
          videoMode,
          ...(videoMode === 'manual' ? { joinUrl: manualJoinUrl.trim() } : {}),
          ...(isRecurringEdit ? { scope: editScope } : {}),
          ...(schedulingTimeZone ? { timeZone: schedulingTimeZone } : {}),
        };

        const res = await fetch(`/api/scheduling/meetings/${meeting._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(typeof data.error === 'string' ? data.error : 'Failed to update meeting.');
          return;
        }
        onSuccess?.();
        onClose();
        return;
      }

      const body: Record<string, unknown> = {
        title: title.trim(),
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        linkedProjectIds,
        attendeeEmployeeIds,
        externalAttendeeEmails: externalEmails,
        syncToGoogle: true,
        videoMode,
        ...(videoMode === 'manual' ? { joinUrl: manualJoinUrl.trim() } : {}),
        ...(schedulingTimeZone ? { timeZone: schedulingTimeZone } : {}),
      };

      if (repeatPreset !== 'none') {
        let untilIso: string | undefined;
        if (recurrenceEnd === 'on' && recurrenceUntil) {
          untilIso = new Date(`${recurrenceUntil}T23:59:59`).toISOString();
        }
        const countNum =
          recurrenceEnd === 'after' ? parseInt(recurrenceCount, 10) : undefined;
        body.recurrence = {
          preset: repeatPreset,
          end: recurrenceEnd,
          ...(recurrenceEnd === 'on' && untilIso ? { until: untilIso } : {}),
          ...(recurrenceEnd === 'after' && countNum != null ? { count: countNum } : {}),
        };
      }

      const res = await fetch('/api/scheduling/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Failed to create meeting.');
        return;
      }
      onSuccess?.({
        invitesSent: typeof data.invitesSent === 'number' ? data.invitesSent : undefined,
        skippedAttendees: Array.isArray(data.skippedAttendees) ? data.skippedAttendees : undefined,
      });
      onClose();
    } catch {
      setError(mode === 'edit' ? 'Failed to update meeting.' : 'Failed to create meeting.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === 'edit' ? 'Edit meeting' : 'New meeting'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="rounded-lg border border-error/30 bg-error-light px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}

        {isRecurringEdit && (
          <div className="rounded-lg border border-border bg-background-card px-3 py-2 space-y-2">
            <p className="text-sm font-medium text-text-primary">Recurring series</p>
            <p className="text-xs text-text-secondary">Choose what this update applies to.</p>
            <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
              <input
                type="radio"
                name="editScope"
                checked={editScope === 'instance'}
                onChange={() => setEditScope('instance')}
              />
              This occurrence only
            </label>
            <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
              <input
                type="radio"
                name="editScope"
                checked={editScope === 'series'}
                onChange={() => setEditScope('series')}
              />
              Entire series
            </label>
          </div>
        )}

        <Input
          label="Meeting title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Meeting title"
          required
        />
        <div className="flex flex-wrap gap-4">
          <label className="text-sm text-text-primary">
            Start
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              required
              className={formInputClass}
            />
          </label>
          <label className="text-sm text-text-primary">
            End
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              required
              className={formInputClass}
            />
          </label>
        </div>

        {mode === 'create' && (
          <RecurrenceFields
            repeatPreset={repeatPreset}
            onRepeatPresetChange={setRepeatPreset}
            recurrenceEnd={recurrenceEnd}
            onRecurrenceEndChange={setRecurrenceEnd}
            recurrenceUntil={recurrenceUntil}
            onRecurrenceUntilChange={setRecurrenceUntil}
            recurrenceCount={recurrenceCount}
            onRecurrenceCountChange={setRecurrenceCount}
            inputClass={formInputClass}
            anchorDate={start ? new Date(start) : undefined}
            occurrenceLabel="meetings"
          />
        )}

        <div>
          <p className="text-sm font-medium text-text-primary mb-2">Video call (optional)</p>
          <div className="space-y-2 rounded-lg border border-border p-3 bg-background-card">
            <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
              <input
                type="radio"
                name="videoMode"
                checked={videoMode === 'none'}
                onChange={() => setVideoMode('none')}
              />
              No video link
            </label>
            <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
              <input
                type="radio"
                name="videoMode"
                checked={videoMode === 'google_meet'}
                onChange={() => setVideoMode('google_meet')}
              />
              Add Google Meet link
            </label>
            <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
              <input
                type="radio"
                name="videoMode"
                checked={videoMode === 'manual'}
                onChange={() => setVideoMode('manual')}
              />
              Custom link (Zoom, Teams, etc.)
            </label>
            {videoMode === 'manual' && (
              <input
                type="url"
                value={manualJoinUrl}
                onChange={(e) => setManualJoinUrl(e.target.value)}
                placeholder="https://zoom.us/j/..."
                className={formInputClass + ' mt-0 w-full'}
              />
            )}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-text-primary mb-2">Invite team members (optional)</p>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto rounded-lg border border-border p-3 bg-background-card">
            {inviteableEmployees.length === 0 ? (
              <p className="text-sm text-text-secondary">No team members with email available to invite.</p>
            ) : (
              inviteableEmployees.map((emp) => (
                <label
                  key={emp._id.toString()}
                  className="flex items-center gap-1.5 text-sm text-text-primary cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={attendeeEmployeeIds.includes(emp._id.toString())}
                    onChange={() => toggleAttendee(emp._id.toString())}
                  />
                  {emp.name}
                </label>
              ))
            )}
          </div>
          {employeesWithoutEmail.length > 0 && (
            <p className="text-xs text-text-secondary mt-1">
              {employeesWithoutEmail.map((e) => e.name).join(', ')} cannot be invited until an email is added in Team settings.
            </p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-text-primary mb-2">External guests (optional)</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={externalEmailInput}
              onChange={(e) => setExternalEmailInput(e.target.value)}
              placeholder="email@example.com"
              className={formInputClass + ' mt-0 flex-1'}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addExternalEmail();
                }
              }}
            />
            <Button type="button" variant="secondary" size="sm" className="shrink-0 self-end" onClick={addExternalEmail}>
              Add
            </Button>
          </div>
          {externalEmails.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {externalEmails.map((email) => (
                <li
                  key={email}
                  className="inline-flex items-center gap-1 rounded-full bg-background-card border border-border px-2 py-0.5 text-xs text-text-primary"
                >
                  {email}
                  <button
                    type="button"
                    className="text-text-secondary hover:text-text-primary"
                    onClick={() => setExternalEmails((prev) => prev.filter((e) => e !== email))}
                    aria-label={`Remove ${email}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-text-primary mb-2">Link projects (optional)</p>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto rounded-lg border border-border p-3 bg-background-card">
            {projects.length === 0 ? (
              <p className="text-sm text-text-secondary">No projects available.</p>
            ) : (
              projects.map((p) => (
                <label
                  key={p._id.toString()}
                  className="flex items-center gap-1.5 text-sm text-text-primary cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={linkedProjectIds.includes(p._id.toString())}
                    onChange={() => toggleProject(p._id.toString())}
                  />
                  {p.name}
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !title.trim() || !start || !end}>
            {submitting
              ? mode === 'edit'
                ? 'Saving…'
                : 'Creating…'
              : mode === 'edit'
                ? 'Save changes'
                : 'Create meeting'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
