'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  aiEmployees,
  type AiEmployeeKey,
} from '@/lib/ai/teamWorkspace';
import {
  companyDisplayName,
  FLAGSHIP_MODEL_OPTION_STYLE,
  modelOptionLabel,
  shortModelDisplayName,
} from '@/lib/ai/rolePipeline/providerCatalog';
import { useAiSnapshot } from './useAiSnapshot';
import { ModelMetaStrip } from '@/components/ai/ModelMetaStrip';

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

type CatalogModel = {
  id: string;
  label: string;
  bestAt?: string;
  strengths?: string[];
  contextTokens?: number | null;
  flagship?: boolean;
  pricing?: { label: string };
};

type CatalogProvider = {
  id: string;
  label: string;
  models: CatalogModel[];
};

type DiscoveredModelsState = {
  models: CatalogModel[];
  error: string | null;
  loading: boolean;
};

type CreditHint = {
  hint: string;
  kind: string;
  error: string | null;
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

function modelsForCredential(
  profile: Profile | undefined,
  catalog: CatalogProvider[]
): CatalogModel[] {
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
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [discoveredByProfile, setDiscoveredByProfile] = useState<Record<string, DiscoveredModelsState>>(
    {}
  );
  const discoveredRef = useRef(discoveredByProfile);
  discoveredRef.current = discoveredByProfile;
  const [creditHints, setCreditHints] = useState<Record<string, CreditHint>>({});
  const [freePoolHint, setFreePoolHint] = useState<string | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);

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

  const loadCredits = useCallback(async (id: string, refresh = false) => {
    setCreditsLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(id)}/ai/pipeline/balances${refresh ? '?refresh=1' : ''}`,
        { cache: 'no-store' }
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to load credits.');
      setFreePoolHint(body.freePool?.hint ?? null);
      const next: Record<string, CreditHint> = {};
      for (const row of body.credentials ?? []) {
        next[row.profileId] = { hint: row.hint, kind: row.kind, error: row.error };
      }
      setCreditHints(next);
    } finally {
      setCreditsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!projectId) return;
    void loadPipelineConfig(projectId).catch((err) =>
      setMessage(err instanceof Error ? err.message : 'Unable to load pipelines.')
    );
  }, [projectId, loadPipelineConfig]);

  useEffect(() => {
    if (!projectId) return;
    void loadCredits(projectId).catch(() => undefined);
  }, [projectId, loadCredits]);

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
        const models = (body.models ?? []) as CatalogModel[];
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
    const modelLabel = shortModelDisplayName(
      catalogModels.find((item) => item.id === binding.model)?.label ??
        discovered.find((item) => item.id === binding.model)?.label ??
        binding.model
    );
    const credit = creditHints[credential.id]?.hint;
    const base = modelLabel ? `${company} · ${modelLabel}` : company;
    return credit ? `${base} · ${credit}` : base;
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
      setMessage('Role models saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed.');
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
    const selectedMeta = models.find((item) => item.id === binding.model) ?? null;
    const freeLocal =
      isCustom || credential?.tier === 'local_remote'
        ? { ...selectedMeta, pricing: selectedMeta?.pricing ?? { label: 'Free' } }
        : selectedMeta;

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
                {creditHints[profile.id]?.hint ? ` · ${creditHints[profile.id]!.hint}` : ''}
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
                  <option
                    key={item.id}
                    value={item.id}
                    style={item.flagship ? FLAGSHIP_MODEL_OPTION_STYLE : undefined}
                  >
                    {modelOptionLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <ModelMetaStrip meta={binding.model ? freeLocal : null} />
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
          <div className="space-y-1">
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
                  <option
                    key={item.id}
                    value={item.id}
                    style={item.flagship ? FLAGSHIP_MODEL_OPTION_STYLE : undefined}
                  >
                    {modelOptionLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <ModelMetaStrip
              meta={
                binding.model
                  ? credential?.tier === 'local_remote'
                    ? { ...selectedMeta, pricing: { label: 'Free' } }
                    : selectedMeta
                  : null
              }
            />
          </div>
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
            Configure which company and model each AI teammate uses for IDE chat and future requests. Planner,
            Worker, and Reviewer bindings are saved per role; IDE chat uses the Worker model.
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
        <h2 className="text-lg font-semibold">Models</h2>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-stretch">
          {[
            { key: 'planner', title: 'Planner', hint: 'Commercial API', binding: planner },
            { key: 'worker', title: 'Worker', hint: 'IDE chat model', binding: worker },
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
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-text-secondary">
              <p>
                Nucleas free pool:{' '}
                <span className="font-medium text-text-primary">{freePoolHint ?? '…'}</span>
              </p>
              <button
                type="button"
                className={button}
                disabled={busy || creditsLoading || !projectId}
                onClick={() =>
                  projectId &&
                  void loadCredits(projectId, true).catch((err) =>
                    setMessage(err instanceof Error ? err.message : 'Unable to refresh credits.')
                  )
                }
              >
                {creditsLoading ? 'Refreshing credits…' : 'Refresh credits'}
              </button>
            </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {stageEditor('Planner', planner, setPlanner, commercialProfiles)}
            {stageEditor('Worker', worker, setWorker, workerProfiles)}
            {stageEditor('Reviewer', reviewer, setReviewer, commercialProfiles)}
            <label className="text-sm">
              Max jobs per phase
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
              Correction retries
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
            <p className="text-xs text-text-secondary lg:col-span-3">
              The worker receives all jobs as one coherent phase. The reviewer checks the combined evidence once, with one correction pass recommended.
            </p>
            <label className="flex items-center gap-2 text-sm mt-6">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                disabled={busy}
              />
              Role enabled
            </label>
            <button
              type="button"
              className={`${button} lg:col-span-3`}
              disabled={busy || !canSave}
              onClick={() => void savePipeline()}
            >
              Save role models
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
          </div>
        ) : (
          <p className="mt-3 text-sm text-text-secondary">Only managers can edit model bindings for this role.</p>
        )}
      </section>
    </main>
  );
}
