'use client';

import { useState } from 'react';
import Link from 'next/link';
import { aiEmployees, type TeamItem } from '@/lib/ai/teamWorkspace';
import { useAiSnapshot } from './useAiSnapshot';

const field = 'min-h-11 rounded-xl border border-border bg-background px-3 py-2';

export default function AiTeamQueue() {
  const [employee, setEmployee] = useState('');
  const [status, setStatus] = useState('saved');
  const [recurring, setRecurring] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const query = new URLSearchParams();
  if (employee) query.set('employee', employee);
  if (status) query.set('status', status);
  if (recurring) query.set('recurring', 'true');
  if (cursor) query.set('cursor', cursor);
  const { data, error, loading, refresh } = useAiSnapshot<{
    items: (TeamItem & { projectId: string; projectName: string })[];
    nextCursor: string | null;
  }>(`/api/ai/team/queue?${query}`);

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">AI task requests</h1>
          <p className="mt-2 text-text-secondary">
            Your private requests across projects you can currently access. These are not human project tasks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={field} href="/workspace/ai-team">
            Open chat
          </Link>
          <Link className={field} href="/workspace/ai-team?kind=task">
            Create a request
          </Link>
        </div>
      </header>

      <div className="rounded-xl border border-border p-4 text-sm space-y-2">
        <p>
          <strong>Saved intake queue.</strong> One-time and recurring items wait here until a scheduler and
          execution path are connected. Recurring templates stay inactive and do not auto-create human tasks.
        </p>
        <p className="text-text-secondary">
          Filter by employee, status, or recurring templates. Empty results mean no matching private requests for
          projects you can still access.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          AI employee
          <select
            className={field}
            value={employee}
            onChange={(event) => {
              setEmployee(event.target.value);
              setCursor(null);
            }}
          >
            <option value="">All employees</option>
            {aiEmployees.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Status
          <select
            className={field}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setCursor(null);
            }}
          >
            <option value="saved">Saved</option>
            <option value="cancelled">Cancelled</option>
            <option value="">All history</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(event) => {
              setRecurring(event.target.checked);
              setCursor(null);
            }}
          />
          Recurring templates only
        </label>
      </div>

      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Loading task requests…</p>}
      {data && !data.items.length && (
        <div className="rounded-xl border border-dashed border-border p-6">
          <h2 className="font-medium">No matching AI task requests</h2>
          <p className="mt-2 text-sm text-text-secondary">
            {recurring
              ? 'No inactive daily/weekly templates match these filters.'
              : 'Create a task request from the AI Team workspace for any accessible project.'}
            {data.nextCursor ? ' Try the next page for older items.' : ''}
          </p>
        </div>
      )}

      <ol className="space-y-3">
        {data?.items.map((item) => (
          <li key={item.id} className="min-w-0 rounded-xl border border-border p-4">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <Link
                className="font-medium underline"
                href={`/workspace/ai-team?projectId=${item.projectId}&employee=${item.employee}&kind=task`}
              >
                {item.projectName}
              </Link>
              <span>{aiEmployees.find((role) => role.id === item.employee)?.name}</span>
            </div>
            <p className="my-3 whitespace-pre-wrap break-words">{item.text}</p>
            <p className="text-xs text-text-secondary">
              {item.status === 'cancelled'
                ? 'Cancelled'
                : item.cadence === 'once'
                  ? 'Saved · awaiting scheduler'
                  : `${item.cadence} template · inactive`}{' '}
              · {new Date(item.createdAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        <button
          className={field}
          disabled={loading}
          onClick={() => {
            setCursor(null);
            refresh();
          }}
        >
          Refresh newest
        </button>
        {data?.nextCursor && (
          <button className={field} disabled={loading} onClick={() => setCursor(data.nextCursor)}>
            Older requests
          </button>
        )}
      </div>
      <p className="text-xs text-text-secondary">
        Bounded pages, newest first. Removed project access can leave a partial page. No background polling.
      </p>
    </main>
  );
}
