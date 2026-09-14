'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  aiEmployees,
  type AiEmployeeKey,
} from '@/lib/ai/teamWorkspace';
import { microsToDollars } from '@/lib/ai/settingsSchema';
import { companyDisplayName } from '@/lib/ai/rolePipeline/providerCatalog';
import { useAiSnapshot } from './useAiSnapshot';

const field = 'w-full rounded-xl border border-border bg-background p-3 text-text-primary';
const button = 'min-h-11 rounded-xl border border-border px-4 py-2 text-sm disabled:opacity-50';

type Profile = {
  id: string;
  label: string;
  provider?: string;
  tier: string;
  model: string;
  enabled: boolean;
};

type CatalogProvider = {
  id: string;
  label: string;
  models: { id: string; label: string }[];
};

type DiscoveredModelsState = {
  models: { id: string; label: string }[];
  error: string | null;
  loading: boolean;
};

type StageBinding = {
  modelProfileId: string;
  model: string;
};

type Pipeline = {
  id: string;
  employee: AiEmployeeKey;
  planner: StageBinding;
  worker: StageBinding;
  reviewer: StageBinding;
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

function modelsForCredential(
  profile: Profile | undefined,
  catalog: CatalogProvider[]
): { id: string; label: string }[] {
  if (!profile) return [];
  const providerId = profile.provider ?? 'custom';
  if (providerId === 'custom') return [];
  return catalog.find((item) => item.id === providerId)?.models ?? [];
}

function isCustomCredential(profile: Profile | undefined): boolean {
  return (profile?.provider ?? 'custom') === 'custom';
}

function companyName(profile: Profile): string {
  return companyDisplayName({ label: profile.label, provider: profile.provider });
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
  const [catalog, setCatalog] = useState<CatalogProvider[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [planner, setPlanner] = useState<StageBinding>({ modelProfileId: '', model: '' });
  const [worker, setWorker] = useState<StageBinding>({ modelProfileId: '', model: '' });
  const [reviewer, setReviewer] = useState<StageBinding>({ modelProfileId: '', model: '' });
  const [maxSubtasks, setMaxSubtasks] = useState(5);
  const [maxRetries, setMaxRetries] = useState(1);
  const [enabled, setEnabled] = useState(true);
  const [brief, setBrief] = useState('');
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<StageEvent[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [discoveredByProfile, setDiscoveredByProfile] = useState<Record<string, DiscoveredModelsState>>(
    {}
  );
  const discoveredRef = useRef(discoveredByProfile);
  discoveredRef.current = discoveredByProfile;

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
    setCatalog(body.catalog ?? []);
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
    const defaultCommercial = commercialProfiles[0];
    const defaultWorker = workerProfiles[0];
    const defaultReviewer = commercialProfiles[1] ?? commercialProfiles[0];
    const firstModel = (profile?: Profile) => modelsForCredential(profile, catalog)[0]?.id ?? profile?.model ?? '';

    if (!current) {
      setPlanner({
        modelProfileId: defaultCommercial?.id ?? '',
        model: firstModel(defaultCommercial),
      });
      setWorker({
        modelProfileId: defaultWorker?.id ?? '',
        model: firstModel(defaultWorker),
      });
      setReviewer({
        modelProfileId: defaultReviewer?.id ?? '',
        model: firstModel(defaultReviewer),
      });
      setMaxSubtasks(5);
      setMaxRetries(1);
      setEnabled(true);
      return;
    }
    setPlanner({
      modelProfileId: current.planner.modelProfileId,
      model: current.planner.model || firstModel(profiles.find((p) => p.id === current.planner.modelProfileId)),
    });
    setWorker({
      modelProfileId: current.worker.modelProfileId,
      model: current.worker.model || firstModel(profiles.find((p) => p.id === current.worker.modelProfileId)),
    });
    setReviewer({
      modelProfileId: current.reviewer.modelProfileId,
      model: current.reviewer.model || firstModel(profiles.find((p) => p.id === current.reviewer.modelProfileId)),
    });
    setMaxSubtasks(current.maxSubtasks);
    setMaxRetries(current.maxWorkerRetries);
    setEnabled(current.enabled);
  }, [pipelines, employee, commercialProfiles, workerProfiles, catalog, profiles]);

  const loadDiscoveredModels = useCallback(
    async (
      id: string,
      profileId: string,
      opts?: { force?: boolean; selectFirstFor?: 'planner' | 'worker' | 'reviewer' | 'all' }
    ) => {
      if (!profileId) return;
      const existing = discoveredRef.current[profileId];
      if (!opts?.force && existing?.loading) return;
      if (!opts?.force && existing && (existing.models.length > 0 || existing.error)) {
        if (opts?.selectFirstFor && existing.models[0]) {
          const firstId = existing.models[0].id;
          const models = existing.models;
          const patch = (binding: StageBinding) => {
            if (binding.modelProfileId !== profileId) return binding;
            if (binding.model && models.some((item) => item.id === binding.model)) return binding;
            return { ...binding, model: firstId };
          };
          if (opts.selectFirstFor === 'all' || opts.selectFirstFor === 'planner') setPlanner(patch);
          if (opts.selectFirstFor === 'all' || opts.selectFirstFor === 'worker') setWorker(patch);
          if (opts.selectFirstFor === 'all' || opts.selectFirstFor === 'reviewer') setReviewer(patch);
        }
        return;
      }

      setDiscoveredByProfile((current) => ({
        ...current,
        [profileId]: { models: current[profileId]?.models ?? [], error: null, loading: true },
      }));
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(id)}/ai/pipeline/models?profileId=${encodeURIComponent(profileId)}`,
          { cache: 'no-store' }
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'Unable to list local models.');
        const models = (body.models ?? []) as { id: string; label: string }[];
        setDiscoveredByProfile((current) => ({
          ...current,
          [profileId]: { models, error: body.error ?? null, loading: false },
        }));
        if (opts?.selectFirstFor && models[0]) {
          const firstId = models[0].id;
          const patch = (binding: StageBinding) => {
            if (binding.modelProfileId !== profileId) return binding;
            if (binding.model && models.some((item) => item.id === binding.model)) return binding;
            return { ...binding, model: firstId };
          };
          if (opts.selectFirstFor === 'all' || opts.selectFirstFor === 'planner') setPlanner(patch);
          if (opts.selectFirstFor === 'all' || opts.selectFirstFor === 'worker') setWorker(patch);
          if (opts.selectFirstFor === 'all' || opts.selectFirstFor === 'reviewer') setReviewer(patch);
        }
      } catch (err) {
        setDiscoveredByProfile((current) => ({
          ...current,
          [profileId]: {
            models: [],
            error: err instanceof Error ? err.message : 'Unable to list local models.',
            loading: false,
          },
        }));
      }
    },
    []
  );

  useEffect(() => {
    if (!projectId) return;
    const customIds = [planner.modelProfileId, worker.modelProfileId, reviewer.modelProfileId].filter(
      (profileId) => {
        const profile = profiles.find((item) => item.id === profileId);
        return Boolean(profileId && isCustomCredential(profile));
      }
    );
    for (const profileId of new Set(customIds)) {
      void loadDiscoveredModels(projectId, profileId, { selectFirstFor: 'all' });
    }
  }, [
    projectId,
    planner.modelProfileId,
    worker.modelProfileId,
    reviewer.modelProfileId,
    profiles,
    loadDiscoveredModels,
  ]);

  function stageSummary(binding: StageBinding): string {
    const credential = profiles.find((item) => item.id === binding.modelProfileId);
    if (!credential) return 'Unassigned';
    const company = companyName(credential);
    const catalogModels = modelsForCredential(credential, catalog);
    const discovered = discoveredByProfile[credential.id]?.models ?? [];
    const modelLabel =
      catalogModels.find((item) => item.id === binding.model)?.label ??
      discovered.find((item) => item.id === binding.model)?.label ??
      binding.model;
    return modelLabel ? `${company} · ${modelLabel}` : company;
  }

  function setCredential(
    setter: (value: StageBinding) => void,
    nextId: string,
    credentials: Profile[]
  ) {
    const profile = credentials.find((item) => item.id === nextId);
    if (isCustomCredential(profile)) {
      setter({ modelProfileId: nextId, model: '' });
      if (projectId && nextId) {
        void loadDiscoveredModels(projectId, nextId, { force: true, selectFirstFor: 'all' });
      }
      return;
    }
    const nextModel = modelsForCredential(profile, catalog)[0]?.id ?? profile?.model ?? '';
    setter({ modelProfileId: nextId, model: nextModel });
  }

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
          planner,
          worker,
          reviewer,
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

  function stageEditor(
    title: string,
    binding: StageBinding,
    setBinding: (value: StageBinding) => void,
    credentials: Profile[]
  ) {
    const credential = profiles.find((item) => item.id === binding.modelProfileId);
    const catalogModels = modelsForCredential(credential, catalog);
    const isCustom = isCustomCredential(credential);
    const discovered = binding.modelProfileId ? discoveredByProfile[binding.modelProfileId] : undefined;
    const localModels = discovered?.models ?? [];
    const models = isCustom ? localModels : catalogModels;
    const showFreeformFallback = isCustom && !discovered?.loading && localModels.length === 0;

    return (
      <div className="space-y-2 rounded-xl border border-border p-3">
        <div className="text-sm font-medium">{title}</div>
        <label className="block text-sm">
          Company
          <select
            className={`${field} mt-1`}
            value={binding.modelProfileId}
            onChange={(event) => setCredential(setBinding, event.target.value, credentials)}
            disabled={busy}
          >
            <option value="">Select…</option>
            {credentials.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {companyName(profile)}
                {profile.tier === 'local_remote' ? ' (local)' : ''}
              </option>
            ))}
          </select>
        </label>
        {isCustom ? (
          <div className="space-y-2">
            <label className="block text-sm">
              Model
              <select
                className={`${field} mt-1`}
                value={localModels.some((item) => item.id === binding.model) ? binding.model : ''}
                onChange={(event) => setBinding({ ...binding, model: event.target.value })}
                disabled={busy || !binding.modelProfileId || discovered?.loading || localModels.length === 0}
              >
                <option value="">{discovered?.loading ? 'Loading models…' : 'Select…'}</option>
                {localModels.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={button}
              disabled={busy || !projectId || !binding.modelProfileId || discovered?.loading}
              onClick={() =>
                projectId &&
                binding.modelProfileId &&
                void loadDiscoveredModels(projectId, binding.modelProfileId, {
                  force: true,
                  selectFirstFor: 'all',
                })
              }
            >
              {discovered?.loading ? 'Refreshing…' : 'Refresh models'}
            </button>
            {discovered?.error ? (
              <p className="text-xs text-text-secondary">{discovered.error}</p>
            ) : null}
            {showFreeformFallback ? (
              <label className="block text-sm">
                Model id (manual)
                <input
                  className={`${field} mt-1`}
                  value={binding.model}
                  onChange={(event) => setBinding({ ...binding, model: event.target.value })}
                  placeholder="host model id"
                  disabled={busy || !binding.modelProfileId}
                />
              </label>
            ) : null}
          </div>
        ) : (
          <label className="block text-sm">
            Model
            <select
              className={`${field} mt-1`}
              value={binding.model}
              onChange={(event) => setBinding({ ...binding, model: event.target.value })}
              disabled={busy || !binding.modelProfileId || models.length === 0}
            >
              <option value="">Select…</option>
              {models.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    );
  }

  const canSave =
    Boolean(planner.modelProfileId && planner.model) &&
    Boolean(worker.modelProfileId && worker.model) &&
    Boolean(reviewer.modelProfileId && reviewer.model);

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-text-secondary">Your workspace</p>
          <h1 className="text-3xl font-semibold tracking-tight">AI Team</h1>
          <p className="mt-2 max-w-2xl text-text-secondary">
            Each role runs Planner → Worker → Reviewer. Pick a company credential and any of its models per stage,
            then start a governed pipeline run.
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
            { key: 'planner', title: 'Planner', hint: 'Commercial API', binding: planner },
            { key: 'worker', title: 'Worker', hint: 'Local / remote host', binding: worker },
            { key: 'reviewer', title: 'Reviewer', hint: 'Commercial API', binding: reviewer },
          ].map((stage, index) => (
            <div key={stage.key} className="flex flex-1 items-stretch gap-3">
              <div className="flex-1 rounded-xl border border-border bg-background p-3">
                <div className="text-xs uppercase tracking-wide text-text-secondary">{stage.title}</div>
                <div className="mt-1 font-medium text-text-primary">{stageSummary(stage.binding)}</div>
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
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {stageEditor('Planner', planner, setPlanner, commercialProfiles)}
            {stageEditor('Worker', worker, setWorker, workerProfiles)}
            {stageEditor('Reviewer', reviewer, setReviewer, commercialProfiles)}
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
              className={`${button} lg:col-span-3`}
              disabled={busy || !canSave}
              onClick={() => void savePipeline()}
            >
              Save role pipeline
            </button>
            {profiles.length === 0 ? (
              <p className="text-sm text-text-secondary lg:col-span-3">
                No company credentials yet. A platform admin must add them under{' '}
                <Link className="underline" href="/admin/ai/models">
                  Admin → AI API keys
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
