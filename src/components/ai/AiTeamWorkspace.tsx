'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  aiEmployees,
  type AiEmployeeKey,
} from '@/lib/ai/teamWorkspace';
import { microsToDollars } from '@/lib/ai/settingsSchema';
import { useAiSnapshot } from './useAiSnapshot';

const field = 'w-full rounded-xl border border-border bg-background p-3 text-text-primary';
const button = 'min-h-11 rounded-xl border border-border px-4 py-2 text-sm disabled:opacity-50';

type Profile = {
  id: string;
  label: string;
  tier: string;
  model: string;
  enabled: boolean;
};

type Pipeline = {
  id: string;
  employee: AiEmployeeKey;
  planner: { modelProfileId: string };
  worker: { modelProfileId: string };
  reviewer: { modelProfileId: string };
  maxSubtasks: number;
  maxWorkerRetries: number;
  enabled: boolean;
};

type PipelineRun = {
  id: string;
  employee: string;
  brief: string;
  status: string;
  summary: string;
  totalCostMicros: number | null;
  createdAt: string | null;
};

type StageEvent = {
  id: string;
  sequence: number;
  stage: string;
  status: string;
  modelLabel?: string | null;
  subtaskId?: string | null;
  summary: string;
  costMicros?: number | null;
  reservedMicros?: number | null;
  noProviderFee?: boolean;
};

function costLine(event: StageEvent): string | null {
  if (event.noProviderFee) return '$0.00 · no provider fee';
  if (event.costMicros != null) return `$${microsToDollars(event.costMicros)}`;
  if (event.reservedMicros != null && event.reservedMicros > 0) {
    return `Reserved $${microsToDollars(event.reservedMicros)}`;
  }
  return null;
}

export default function AiTeamWorkspace({
  initialProjectId = '',
  initialEmployee = 'product',
}: {
  initialProjectId?: string;
  initialEmployee?: AiEmployeeKey;
  initialView?: 'message' | 'task';
}) {
  const { data, error, loading } = useAiSnapshot<{
    projects: { id: string; name: string }[];
    limited: boolean;
  }>('/api/ai/team/projects');
  const [selected, setSelected] = useState(initialProjectId);
  const [employee, setEmployee] = useState<AiEmployeeKey>(initialEmployee);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [plannerId, setPlannerId] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [reviewerId, setReviewerId] = useState('');
  const [maxSubtasks, setMaxSubtasks] = useState(5);
  const [maxRetries, setMaxRetries] = useState(1);
  const [enabled, setEnabled] = useState(true);
  const [brief, setBrief] = useState('');
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<StageEvent[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const projectId = selected || data?.projects[0]?.id || '';

  const commercialProfiles = useMemo(
    () => profiles.filter((item) => item.tier === 'commercial'),
    [profiles]
  );
  const workerProfiles = useMemo(
    () => profiles.filter((item) => item.tier === 'local_remote' || item.tier === 'commercial'),
    [profiles]
  );

  const loadPipelineConfig = useCallback(async (id: string) => {
    const response = await fetch(`/api/projects/${encodeURIComponent(id)}/ai/pipeline`, {
      cache: 'no-store',
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? 'Unable to load pipelines.');
    setProfiles(body.profiles ?? []);
    setPipelines(body.pipelines ?? []);
    setCanManage(Boolean(body.canManage));
  }, []);

  const loadRuns = useCallback(async (id: string, role: AiEmployeeKey) => {
    const response = await fetch(
      `/api/projects/${encodeURIComponent(id)}/ai/pipeline/runs?employee=${encodeURIComponent(role)}`,
      { cache: 'no-store' }
    );
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? 'Unable to load runs.');
    setRuns(body.runs ?? []);
  }, []);

  const loadRunDetail = useCallback(async (id: string, runId: string) => {
    const response = await fetch(
      `/api/projects/${encodeURIComponent(id)}/ai/pipeline/runs?runId=${encodeURIComponent(runId)}`,
      { cache: 'no-store' }
    );
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? 'Unable to load run.');
    setEvents(body.events ?? []);
    setActiveRunId(runId);
  }, []);

  useEffect(() => {
    if (!projectId) return;
    void loadPipelineConfig(projectId).catch((err) =>
      setMessage(err instanceof Error ? err.message : 'Unable to load pipelines.')
    );
  }, [projectId, loadPipelineConfig]);

  useEffect(() => {
    if (!projectId) return;
    void loadRuns(projectId, employee).catch(() => undefined);
  }, [projectId, employee, loadRuns]);

  useEffect(() => {
    const current = pipelines.find((item) => item.employee === employee);
    if (!current) {
      setPlannerId(commercialProfiles[0]?.id ?? '');
      setWorkerId(workerProfiles[0]?.id ?? '');
      setReviewerId(commercialProfiles[1]?.id ?? commercialProfiles[0]?.id ?? '');
      setMaxSubtasks(5);
      setMaxRetries(1);
      setEnabled(true);
      return;
    }
    setPlannerId(current.planner.modelProfileId);
    setWorkerId(current.worker.modelProfileId);
    setReviewerId(current.reviewer.modelProfileId);
    setMaxSubtasks(current.maxSubtasks);
    setMaxRetries(current.maxWorkerRetries);
    setEnabled(current.enabled);
  }, [pipelines, employee, commercialProfiles, workerProfiles]);

  const labelFor = (id: string) => profiles.find((item) => item.id === id)?.label ?? 'Unassigned';

  async function savePipeline() {
    if (!projectId || !canManage) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai/pipeline`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee,
          planner: { modelProfileId: plannerId },
          worker: { modelProfileId: workerId },
          reviewer: { modelProfileId: reviewerId },
          maxSubtasks,
          maxWorkerRetries: maxRetries,
          enabled,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to save pipeline.');
      await loadPipelineConfig(projectId);
      setMessage('Role pipeline saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function startRun() {
    if (!projectId || !brief.trim()) return;
    setBusy(true);
    setMessage('');
    setEvents([]);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai/pipeline/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee, brief: brief.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Pipeline run failed.');
      setBrief('');
      setMessage(`Run ${body.status}: ${body.summary}`);
      await loadRuns(projectId, employee);
      await loadRunDetail(projectId, body.runId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Run failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-text-secondary">Your workspace</p>
          <h1 className="text-3xl font-semibold tracking-tight">AI Team</h1>
          <p className="mt-2 max-w-2xl text-text-secondary">
            Each role runs Planner → Worker → Reviewer. Assign commercial API models to plan/review and a
            local-remote model to execute, then start a governed pipeline run.
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

      {(error || message) && (
        <p role="status" className="mb-4 rounded-xl border border-border p-3 text-sm">
          {message || error}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm text-text-secondary">
          Project
          <select
            className={`${field} mt-1 min-w-[14rem]`}
            value={projectId}
            onChange={(event) => setSelected(event.target.value)}
            disabled={loading || busy}
          >
            {(data?.projects ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {aiEmployees.map((role) => (
          <button
            key={role.id}
            type="button"
            className={`rounded-xl px-3 py-2 text-sm ${
              employee === role.id
                ? 'bg-primary text-white'
                : 'border border-border text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setEmployee(role.id)}
            disabled={busy}
          >
            {role.name}
          </button>
        ))}
      </div>

      <section className="mb-6 rounded-xl border border-border p-4">
        <h2 className="text-lg font-semibold">Pipeline</h2>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-stretch">
          {[
            { key: 'planner', title: 'Planner', hint: 'Commercial API', id: plannerId },
            { key: 'worker', title: 'Worker', hint: 'Local / remote host', id: workerId },
            { key: 'reviewer', title: 'Reviewer', hint: 'Commercial API', id: reviewerId },
          ].map((stage, index) => (
            <div key={stage.key} className="flex flex-1 items-stretch gap-3">
              <div className="flex-1 rounded-xl border border-border bg-background p-3">
                <div className="text-xs uppercase tracking-wide text-text-secondary">{stage.title}</div>
                <div className="mt-1 font-medium text-text-primary">{labelFor(stage.id)}</div>
                <div className="text-xs text-text-secondary">{stage.hint}</div>
              </div>
              {index < 2 ? (
                <div className="hidden items-center text-text-secondary md:flex" aria-hidden>
                  →
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {canManage ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              Planner model
              <select
                className={`${field} mt-1`}
                value={plannerId}
                onChange={(event) => setPlannerId(event.target.value)}
                disabled={busy}
              >
                <option value="">Select…</option>
                {commercialProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Worker model
              <select
                className={`${field} mt-1`}
                value={workerId}
                onChange={(event) => setWorkerId(event.target.value)}
                disabled={busy}
              >
                <option value="">Select…</option>
                {workerProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label} ({profile.tier})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Reviewer model
              <select
                className={`${field} mt-1`}
                value={reviewerId}
                onChange={(event) => setReviewerId(event.target.value)}
                disabled={busy}
              >
                <option value="">Select…</option>
                {commercialProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Max subtasks
              <input
                className={`${field} mt-1`}
                type="number"
                min={1}
                max={8}
                value={maxSubtasks}
                onChange={(event) => setMaxSubtasks(Number(event.target.value))}
                disabled={busy}
              />
            </label>
            <label className="text-sm">
              Max worker retries
              <input
                className={`${field} mt-1`}
                type="number"
                min={0}
                max={2}
                value={maxRetries}
                onChange={(event) => setMaxRetries(Number(event.target.value))}
                disabled={busy}
              />
            </label>
            <label className="flex items-center gap-2 text-sm mt-6">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                disabled={busy}
              />
              Pipeline enabled
            </label>
            <button
              type="button"
              className={`${button} sm:col-span-3`}
              disabled={busy || !plannerId || !workerId || !reviewerId}
              onClick={() => void savePipeline()}
            >
              Save role pipeline
            </button>
            {profiles.length === 0 ? (
              <p className="text-sm text-text-secondary sm:col-span-3">
                No model profiles yet. A platform admin must add them under{' '}
                <Link className="underline" href="/admin/ai/models">
                  Admin → AI model registry
                </Link>
                .
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-text-secondary">Only managers can edit model bindings for this role.</p>
        )}
      </section>

      <section className="mb-6 rounded-xl border border-border p-4">
        <h2 className="text-lg font-semibold">Start run</h2>
        <textarea
          className={`${field} mt-3 min-h-28`}
          placeholder="Brief for this role pipeline…"
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          disabled={!projectId || busy}
        />
        <button
          type="button"
          className={`${button} mt-3`}
          disabled={!projectId || busy || !brief.trim()}
          onClick={() => void startRun()}
        >
          {busy ? 'Running pipeline…' : 'Run Planner → Worker → Reviewer'}
        </button>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <h2 className="text-lg font-semibold">Recent runs</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {runs.map((run) => (
              <li key={run.id}>
                <button
                  type="button"
                  className={`w-full rounded-xl border px-3 py-2 text-left ${
                    activeRunId === run.id ? 'border-primary' : 'border-border'
                  }`}
                  onClick={() => void loadRunDetail(projectId, run.id)}
                >
                  <div className="font-medium">
                    {run.status} · {run.createdAt ? new Date(run.createdAt).toLocaleString() : '—'}
                  </div>
                  <div className="text-text-secondary line-clamp-2">{run.brief}</div>
                </button>
              </li>
            ))}
            {runs.length === 0 ? <li className="text-text-secondary">No runs yet for this role.</li> : null}
          </ul>
        </div>
        <div className="rounded-xl border border-border p-4">
          <h2 className="text-lg font-semibold">Run timeline</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {events.map((event) => (
              <li key={event.id} className="rounded-xl border border-border p-3">
                <div className="text-xs uppercase tracking-wide text-text-secondary">
                  #{event.sequence} · {event.stage} · {event.status}
                  {event.subtaskId ? ` · ${event.subtaskId}` : ''}
                </div>
                <div className="mt-1 text-text-primary whitespace-pre-wrap">{event.summary}</div>
                <div className="mt-1 text-xs text-text-secondary">
                  {event.modelLabel ?? '—'}
                  {costLine(event) ? ` · ${costLine(event)}` : ''}
                </div>
              </li>
            ))}
            {events.length === 0 ? (
              <li className="text-text-secondary">Select a run to inspect Planner / Worker / Reviewer stages.</li>
            ) : null}
          </ul>
        </div>
      </section>
    </main>
  );
}
