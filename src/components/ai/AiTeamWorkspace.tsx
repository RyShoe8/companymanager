'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  aiEmployees,
  type AiEmployeeKey,
  type TeamItem,
  type TeamSnapshot,
} from '@/lib/ai/teamWorkspace';
import { useAiSnapshot } from './useAiSnapshot';

const field = 'w-full rounded-xl border border-border bg-background p-3 text-text-primary';
const button = 'min-h-11 rounded-xl border border-border px-4 py-2 text-sm disabled:opacity-50';

function speakerLabel(item: TeamItem, employeeName: string) {
  if (item.role === 'assistant') return employeeName;
  if (item.role === 'status') return 'System';
  return 'You';
}

export default function AiTeamWorkspace({
  initialProjectId = '',
  initialEmployee = 'product',
  initialView = 'message',
}: {
  initialProjectId?: string;
  initialEmployee?: AiEmployeeKey;
  initialView?: 'message' | 'task';
}) {
  const { data, error, loading, refresh } = useAiSnapshot<{
    projects: { id: string; name: string }[];
    limited: boolean;
  }>('/api/ai/team/projects');
  const [selected, setSelected] = useState(initialProjectId);
  const [employee, setEmployee] = useState<AiEmployeeKey>(initialEmployee);
  const [hasDraft, setHasDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingProject, setPendingProject] = useState<string | null>(null);
  const projectId = selected || data?.projects[0]?.id || '';

  useEffect(() => {
    if (!hasDraft) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasDraft]);

  function changeProject(id: string) {
    if (hasDraft) {
      setPendingProject(id);
      return;
    }
    setSelected(id);
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-text-secondary">Your workspace</p>
          <h1 className="text-3xl font-semibold tracking-tight">AI Team</h1>
          <p className="mt-2 max-w-2xl text-text-secondary">
            Chat with role presets against a selected project, or queue task requests for later execution.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={button} href="/workspace/ai-team/queue">
            All project requests
          </Link>
          <Link className={button} href="/workspace/ai-attention">
            Needs attention
          </Link>
        </div>
      </header>

      <div className="mb-5 rounded-xl border border-border bg-background-elevated p-4 text-sm" role="note">
        <strong>Live gateway path.</strong> Conversation sends persist your message, then attempt a real model
        reply through the shared AI gateway. When inference is disabled or unreachable, a system status turn is
        stored instead—never a simulated agent reply. Task requests remain inactive templates until scheduling is
        connected.
      </div>

      <label className="mb-6 block max-w-lg text-sm font-medium">
        Project context
        <select
          className={`${field} mt-2`}
          value={projectId}
          disabled={loading || saving}
          onChange={(event) => changeProject(event.target.value)}
        >
          {!data?.projects.length && (
            <option value="">{loading ? 'Loading projects…' : 'No accessible projects'}</option>
          )}
          {initialProjectId && !data?.projects.some((project) => project.id === initialProjectId) && (
            <option value={initialProjectId}>Selected project</option>
          )}
          {data?.projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>

      {pendingProject && (
        <div className="mb-5 rounded-xl border border-border p-4" role="alert">
          <p>You have an unsaved draft in this project. Save it first, or discard it to switch projects.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button className={button} onClick={() => setPendingProject(null)}>
              Keep editing
            </button>
            <button
              className={button}
              disabled={saving}
              onClick={() => {
                setSelected(pendingProject);
                setPendingProject(null);
                setHasDraft(false);
              }}
            >
              Discard draft and switch
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert">
          {error}{' '}
          <button className="underline" onClick={refresh}>
            Retry loading projects
          </button>
        </p>
      )}
      {data?.limited && (
        <p className="mb-4 text-sm">
          Showing accessible projects within the latest 100. Open an older project’s AI planning page to access its
          team workspace directly.
        </p>
      )}

      {projectId ? (
        <ProjectTeam
          key={projectId}
          initialView={initialView}
          projectId={projectId}
          employee={employee}
          onEmployeeChange={setEmployee}
          onDraftChange={setHasDraft}
          onBusyChange={setSaving}
        />
      ) : (
        !loading && <p>Create or join a project to start organizing AI work.</p>
      )}
    </main>
  );
}

function ProjectTeam({
  projectId,
  employee,
  initialView,
  onEmployeeChange,
  onDraftChange,
  onBusyChange,
}: {
  initialView: 'message' | 'task';
  projectId: string;
  employee: AiEmployeeKey;
  onEmployeeChange: (employee: AiEmployeeKey) => void;
  onDraftChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [view, setView] = useState<'message' | 'task'>(initialView);
  const [text, setText] = useState('');
  const [cadence, setCadence] = useState<'once' | 'daily' | 'weekly'>('once');
  const [cursor, setCursor] = useState<string | null>(null);
  const [historyStatus, setHistoryStatus] = useState('saved');
  const [recurringOnly, setRecurringOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const pending = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const active = useRef<AbortController | null>(null);
  const endpoint = `/api/projects/${encodeURIComponent(projectId)}/ai/team`;
  const query = new URLSearchParams({ employee, kind: view });
  if (cursor) query.set('cursor', cursor);
  if (historyStatus) query.set('status', historyStatus);
  if (recurringOnly && view === 'task') query.set('recurring', 'true');
  const { data, error, loading, refresh } = useAiSnapshot<TeamSnapshot>(`${endpoint}?${query}`);

  useEffect(() => () => active.current?.abort(), []);

  const role = aiEmployees.find((item) => item.id === employee)!;
  const items =
    data?.items.filter((item) => item.employee === employee && item.kind === view) ?? [];
  // API returns newest first; chat reads oldest→newest.
  const thread = view === 'message' ? [...items].reverse() : items;

  useEffect(() => {
    if (view !== 'message') return;
    threadEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [view, thread.length, busy]);

  async function mutate(cancelId?: string) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    onBusyChange(true);
    setNotice('');
    const input = {
      employee,
      kind: view,
      text: text.trim(),
      cadence: view === 'task' ? cadence : 'once',
    };
    const fingerprint = JSON.stringify(input);
    if (!cancelId && pending.current?.fingerprint !== fingerprint) {
      pending.current = { fingerprint, requestId: crypto.randomUUID() };
    }
    try {
      const response = await fetch(endpoint, {
        method: cancelId ? 'PATCH' : 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          cancelId
            ? { id: cancelId }
            : { ...input, requestId: pending.current!.requestId }
        ),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to save request.');
      if (!controller.signal.aborted) {
        if (!cancelId) {
          setText('');
          onDraftChange(false);
          pending.current = null;
        }
        if (cancelId) {
          setNotice('Request cancelled. Its history is retained.');
        } else if (view === 'message') {
          setNotice(
            body.reply?.role === 'assistant'
              ? 'Message sent and model reply stored.'
              : body.reply?.role === 'status'
                ? `Message saved. ${body.reply.text}`
                : 'Message saved.'
          );
        } else {
          setNotice('Task request saved. No automatic execution was started.');
        }
        setCursor(null);
        refresh();
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setNotice(
          cause instanceof Error ? cause.message : 'Save outcome unknown. Refresh before retrying.'
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        active.current = null;
        setBusy(false);
        onBusyChange(false);
      }
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="min-w-0">
        <h2 className="mb-3 font-semibold">AI employees</h2>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          {aiEmployees.map((item) => (
            <button
              key={item.id}
              disabled={busy}
              aria-pressed={employee === item.id}
              onClick={() => {
                setCursor(null);
                onEmployeeChange(item.id);
              }}
              className={`min-h-20 rounded-xl border p-3 text-left ${
                employee === item.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-background-elevated'
              }`}
            >
              <span className="mb-2 block text-xs font-semibold text-text-secondary">
                {item.initials} · AI role
              </span>
              <span className="font-medium">{item.name}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-text-secondary">
          Shared role presets, not human employee records. Each conversation stays on the selected project.
        </p>
      </aside>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-background-elevated">
        <header className="border-b border-border p-4 sm:p-6">
          <h2 className="text-xl font-semibold">{role.name}</h2>
          <p className="mt-1 text-sm text-text-secondary">{role.description}</p>
          <p className="mt-3 text-sm">
            Context: <strong>{data?.project.name ?? 'Loading selected project…'}</strong>
          </p>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="AI workspace views">
            <button
              className={button}
              aria-pressed={view === 'message'}
              disabled={busy}
              onClick={() => {
                setCursor(null);
                setView('message');
              }}
            >
              Conversation
            </button>
            <button
              className={button}
              aria-pressed={view === 'task'}
              disabled={busy}
              onClick={() => {
                setCursor(null);
                setView('task');
              }}
            >
              Task requests
            </button>
            <Link className={button} href={`/workspace/projects/${projectId}/ai`}>
              Project plans
            </Link>
            <Link className={button} href="/projects">
              Existing project tasks
            </Link>
          </div>
        </header>

        {data?.context && (
          <div className="border-b border-border bg-background/40 p-4 text-sm sm:px-6" role="region" aria-label="Project context for inference">
            <p className="font-medium">
              {data.context.inferenceReady
                ? 'Inference ready for this project context'
                : 'Inference unavailable'}
            </p>
            {data.context.unavailableReason && (
              <p className="mt-1 text-text-secondary">{data.context.unavailableReason}</p>
            )}
            <ul className="mt-2 list-disc space-y-1 pl-5 text-text-secondary">
              {data.context.included.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-text-secondary">
              Remote connection: {data.context.remoteEnabled ? 'enabled' : 'disabled'} · Planning:{' '}
              {data.context.planningEnabled ? 'enabled' : 'disabled'}
            </p>
          </div>
        )}

        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm">
              Request status
              <select
                className={`${field} mt-1`}
                value={historyStatus}
                disabled={busy}
                onChange={(event) => {
                  setHistoryStatus(event.target.value);
                  setCursor(null);
                }}
              >
                <option value="saved">Saved</option>
                <option value="cancelled">Cancelled</option>
                <option value="">All history</option>
              </select>
            </label>
            {view === 'task' && (
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={recurringOnly}
                  disabled={busy}
                  onChange={(event) => {
                    setRecurringOnly(event.target.checked);
                    setCursor(null);
                  }}
                />
                Recurring templates only
              </label>
            )}
          </div>

          {error && <p role="alert">{error}</p>}
          {loading && <p role="status">Loading…</p>}

          {!loading && data && !items.length && (
            <div className="rounded-xl border border-dashed border-border p-6">
              <h3 className="font-medium">
                {view === 'message'
                  ? 'Start a project-scoped conversation'
                  : 'Give your AI employee a clear assignment'}
              </h3>
              <p className="mt-2 text-sm text-text-secondary">
                {cursor
                  ? 'No matching items on this page. Check another page.'
                  : 'Messages and tasks stay in this project; no other project content is included automatically.'}
              </p>
            </div>
          )}

          {view === 'message' ? (
            <div className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-background p-3 sm:p-4">
              {thread.map((item) => (
                <article
                  key={item.id}
                  className={`max-w-[95%] rounded-2xl px-4 py-3 text-sm ${
                    item.role === 'user'
                      ? 'ml-auto bg-primary/15'
                      : item.role === 'status'
                        ? 'border border-dashed border-border bg-background-elevated text-text-secondary'
                        : 'mr-auto bg-background-elevated'
                  }`}
                >
                  <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs text-text-secondary">
                    <span>
                      {speakerLabel(item, role.name)}
                      {item.failureCategory ? ` · ${item.failureCategory}` : ''}
                    </span>
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words">{item.text}</p>
                  {item.status === 'saved' && item.role === 'user' && (
                    <button
                      className="mt-2 text-xs underline disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void mutate(item.id)}
                    >
                      Cancel turn
                    </button>
                  )}
                </article>
              ))}
              <div ref={threadEndRef} />
            </div>
          ) : (
            <ol className="space-y-3">
              {items.map((item) => (
                <li key={item.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-text-secondary">
                    <span>You · {new Date(item.createdAt).toLocaleString()}</span>
                    <span>
                      {item.status === 'cancelled'
                        ? 'Cancelled'
                        : item.cadence === 'once'
                          ? 'Saved · awaiting scheduler'
                          : `${item.cadence} template · inactive`}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words">{item.text}</p>
                  {item.status === 'saved' && (
                    <button
                      className="mt-3 min-h-11 text-sm underline disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void mutate(item.id)}
                    >
                      Cancel saved request
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              className={button}
              disabled={busy || loading}
              onClick={() => {
                setCursor(null);
                refresh();
              }}
            >
              Refresh newest
            </button>
            {data?.nextCursor && (
              <button
                className={button}
                disabled={busy || loading}
                onClick={() => setCursor(data.nextCursor)}
              >
                Older requests
              </button>
            )}
          </div>
          <p className="text-xs text-text-secondary">
            Newest pages load on demand. Lists never poll in the background.
          </p>
        </div>

        <form
          className="border-t border-border p-4 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void mutate();
          }}
        >
          <label className="block text-sm font-medium" htmlFor="ai-team-message">
            {view === 'message' ? `Message for ${role.name}` : `Task brief for ${role.name}`}
          </label>
          <textarea
            id="ai-team-message"
            className={`${field} mt-2 min-h-28 resize-y`}
            maxLength={6000}
            required
            value={text}
            disabled={busy || !data}
            placeholder="What should this employee help with? Include the desired outcome and constraints."
            onChange={(event) => {
              setText(event.target.value);
              onDraftChange(event.target.value.length > 0);
            }}
          />
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            {view === 'task' ? (
              <label className="text-sm">
                Repeat (saved as inactive template)
                <select
                  className={`${field} mt-1`}
                  value={cadence}
                  disabled={busy}
                  onChange={(event) => setCadence(event.target.value as typeof cadence)}
                >
                  <option value="once">One time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>
            ) : (
              <span className="text-xs text-text-secondary">
                {data?.context?.inferenceReady
                  ? 'Send attempts a live model reply via the gateway.'
                  : 'Send stores your message and a status turn until inference is available.'}
              </span>
            )}
            <button
              className={`${button} bg-primary text-white`}
              disabled={busy || loading || !data || !text.trim()}
            >
              {busy
                ? view === 'message'
                  ? 'Sending…'
                  : 'Saving…'
                : view === 'message'
                  ? 'Send message'
                  : 'Save task request'}
            </button>
          </div>
          {notice && (
            <p className="mt-3 text-sm" role="status">
              {notice}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
