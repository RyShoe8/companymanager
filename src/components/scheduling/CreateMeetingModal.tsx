'use client';

import { useEffect, useMemo, useState } from 'react';
import { IProject } from '@/lib/models/Project';
import { IEmployee } from '@/lib/models/Employee';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { RecurrenceEnd, RecurrencePreset } from '@/lib/scheduling/recurrence';
import { validateRecurrenceInput } from '@/lib/scheduling/recurrence';

export type MeetingCreateSuccessInfo = {
  invitesSent?: number;
  skippedAttendees?: { name: string; reason: string }[];
};

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: IProject[];
  employees: IEmployee[];
  currentUserEmployeeId?: string | null;
  onSuccess?: (info?: MeetingCreateSuccessInfo) => void;
}

const REPEAT_OPTIONS: { value: RecurrencePreset; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

const END_OPTIONS: { value: RecurrenceEnd; label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: 'on', label: 'On date' },
  { value: 'after', label: 'After' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const inputClass =
  'block mt-1 w-full rounded-lg border border-border bg-background-card text-text-primary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary';

function employeeHasInviteEmail(emp: IEmployee): boolean {
  return !!(emp.email?.trim() || emp.userId);
}

export default function CreateMeetingModal({
  isOpen,
  onClose,
  projects,
  employees,
  currentUserEmployeeId,
  onSuccess,
}: CreateMeetingModalProps) {
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
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setExternalEmailInput('');
    setError(null);
  }, [isOpen]);

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
    if (creating) return;
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

    setCreating(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        linkedProjectIds,
        attendeeEmployeeIds,
        externalAttendeeEmails: externalEmails,
        syncToGoogle: true,
      };

      if (repeatPreset !== 'none') {
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
      setError('Failed to create meeting.');
    } finally {
      setCreating(false);
    }
  };

  const showRecurrenceEnd = repeatPreset !== 'none';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New meeting" maxWidth="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="rounded-lg border border-error/30 bg-error-light px-3 py-2 text-sm text-error">
            {error}
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
              className={inputClass}
            />
          </label>
          <label className="text-sm text-text-primary">
            End
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              required
              className={inputClass}
            />
          </label>
        </div>

        <label className="text-sm text-text-primary block">
          Repeat
          <select
            value={repeatPreset}
            onChange={(e) => setRepeatPreset(e.target.value as RecurrencePreset)}
            className={inputClass}
          >
            {REPEAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {showRecurrenceEnd && (
          <div className="space-y-3 rounded-lg border border-border p-3 bg-background-card">
            <label className="text-sm text-text-primary block">
              Ends
              <select
                value={recurrenceEnd}
                onChange={(e) => setRecurrenceEnd(e.target.value as RecurrenceEnd)}
                className={inputClass}
              >
                {END_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {recurrenceEnd === 'on' && (
              <label className="text-sm text-text-primary block">
                End date
                <input
                  type="date"
                  value={recurrenceUntil}
                  onChange={(e) => setRecurrenceUntil(e.target.value)}
                  required
                  className={inputClass}
                />
              </label>
            )}
            {recurrenceEnd === 'after' && (
              <label className="text-sm text-text-primary block">
                Occurrences
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={recurrenceCount}
                  onChange={(e) => setRecurrenceCount(e.target.value)}
                  required
                  className={inputClass}
                />
              </label>
            )}
          </div>
        )}

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
              className={inputClass + ' mt-0 flex-1'}
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
          <Button type="button" variant="secondary" onClick={handleClose} disabled={creating}>
            Cancel
          </Button>
          <Button type="submit" disabled={creating || !title.trim() || !start || !end}>
            {creating ? 'Creating…' : 'Create meeting'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
