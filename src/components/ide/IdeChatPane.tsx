'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { formatIdeCostUsd } from '@/lib/ide/costDisplay';
import {
  employeeForIdeMode,
  ideChatModes,
  isIdeDirectMode,
  isIdeWorkerMode,
  type IdeChatMode,
} from '@/lib/ide/modes';
import {
  readStoredIdeDirectSelection,
  writeStoredIdeDirectSelection,
} from '@/lib/ide/chatSelectionStorage';
import { companyDisplayName, FLAGSHIP_MODEL_OPTION_STYLE, modelOptionLabel } from '@/lib/ai/rolePipeline/providerCatalog';
import { ModelMetaStrip } from '@/components/ai/ModelMetaStrip';
import ImagePreviewModal from '@/components/shared/ImagePreviewModal';
import type { AiEmployeeKey } from '@/lib/ai/teamWorkspace';

type ChatTurn = {
  requestId: string;
  role: 'user' | 'assistant' | 'status';
  text: string;
  costMicros?: number | null;
  reservedMicros?: number | null;
  noProviderFee?: boolean;
  artifacts?: { kind: 'image'; assetId: string; name: string; url: string }[];
  toolsUsed?: string[];
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

type Profile = {
  id: string;
  label: string;
  provider?: string;
  tier: string;
  enabled: boolean;
};

type Pipeline = {
  employee: AiEmployeeKey;
  planner: { modelProfileId: string; model: string };
  worker: { modelProfileId: string; model: string };
  reviewer: { modelProfileId: string; model: string };
};

type Props = {
  projectId: string | null;
  mode: IdeChatMode;
  onModeChange: (mode: IdeChatMode) => void;
  onOpenRules: () => void;
  width: number;
  onWidthChange: (width: number) => void;
};

const CHAT_MIN_WIDTH = 280;
const CHAT_MAX_WIDTH = 720;
const field = 'w-full rounded border border-border bg-background p-2 text-sm text-text-primary';

export default function IdeChatPane({
  projectId,
  mode,
  onModeChange,
  onOpenRules,
  width,
  onWidthChange,
}: Props) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resizing, setResizing] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [catalog, setCatalog] = useState<{ id: string; label: string; models: CatalogModel[] }[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [directProfileId, setDirectProfileId] = useState('');
  const [directModel, setDirectModel] = useState('');
  const [discovered, setDiscovered] = useState<CatalogModel[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendGenerationRef = useRef(0);
  const historyGenerationRef = useRef(0);

  const loadPipeline = useCallback(async (id: string) => {
    const response = await fetch(`/api/projects/${encodeURIComponent(id)}/ai/pipeline`, {
      cache: 'no-store',
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? 'Unable to load models.');
    setProfiles(body.profiles ?? []);
    setCatalog(body.catalog ?? []);
    setPipelines(body.pipelines ?? []);
  }, []);

  useEffect(() => {
    if (!projectId) {
      setProfiles([]);
      setCatalog([]);
      setPipelines([]);
      setDirectProfileId('');
      setDirectModel('');
      return;
    }
    const stored = readStoredIdeDirectSelection(projectId);
    setDirectProfileId(stored?.profileId ?? '');
    setDirectModel(stored?.model ?? '');
    void loadPipeline(projectId).catch(() => undefined);
  }, [projectId, loadPipeline]);

  useEffect(() => {
    if (!projectId || !directProfileId.trim() || !directModel.trim()) return;
    writeStoredIdeDirectSelection(projectId, {
      profileId: directProfileId,
      model: directModel,
    });
  }, [projectId, directProfileId, directModel]);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    sendGenerationRef.current += 1;
    const generation = ++historyGenerationRef.current;
    setBusy(false);
    setTurns([]);
    setError('');

    if (!projectId) {
      setHistoryLoading(false);
      return;
    }
    if (isIdeDirectMode(mode) && (!directProfileId || !directModel.trim())) {
      setHistoryLoading(false);
      return;
    }

    const controller = new AbortController();
    setHistoryLoading(true);
    const params = new URLSearchParams({ mode });
    if (isIdeDirectMode(mode)) {
      params.set('modelProfileId', directProfileId);
      params.set('model', directModel);
    }

    void (async () => {
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/ai/ide/chat?${params}`,
          { cache: 'no-store', signal: controller.signal }
        );
        if (generation !== historyGenerationRef.current || controller.signal.aborted) return;
        const body = await response.json();
        if (generation !== historyGenerationRef.current || controller.signal.aborted) return;
        if (!response.ok) throw new Error(body.error ?? 'Unable to load chat history.');
        setTurns((body.turns ?? []) as ChatTurn[]);
      } catch (err) {
        if (generation !== historyGenerationRef.current || controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Unable to load chat history.');
      } finally {
        if (generation === historyGenerationRef.current) setHistoryLoading(false);
      }
    })();

    return () => controller.abort();
  }, [projectId, mode, directProfileId, directModel]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [turns]);

  const directCredential = profiles.find((item) => item.id === directProfileId);
  const isCustomDirect = (directCredential?.provider ?? 'custom') === 'custom';

  const catalogModelsForDirect = useMemo(() => {
    if (!directCredential || isCustomDirect) return [];
    return catalog.find((item) => item.id === (directCredential.provider ?? ''))?.models ?? [];
  }, [catalog, directCredential, isCustomDirect]);

  const directModels = isCustomDirect ? discovered : catalogModelsForDirect;
  const directMeta = directModels.find((item) => item.id === directModel) ?? null;

  const loadDiscovered = useCallback(
    async (id: string, profileId: string) => {
      setDiscoverLoading(true);
      setDiscoverError(null);
      try {
        const response = await fetch(
          `/api/projects/${encodeURIComponent(id)}/ai/pipeline/models?profileId=${encodeURIComponent(profileId)}`,
          { cache: 'no-store' }
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'Unable to list models.');
        const models = (body.models ?? []) as CatalogModel[];
        setDiscovered(models);
        setDiscoverError(body.error ?? null);
        if (models[0] && !models.some((item) => item.id === directModel)) {
          setDirectModel(models[0].id);
        }
      } catch (err) {
        setDiscovered([]);
        setDiscoverError(err instanceof Error ? err.message : 'Unable to list models.');
      } finally {
        setDiscoverLoading(false);
      }
    },
    [directModel]
  );

  useEffect(() => {
    if (!projectId || !isIdeDirectMode(mode) || !directProfileId || !isCustomDirect) {
      if (!isCustomDirect) setDiscovered([]);
      return;
    }
    void loadDiscovered(projectId, directProfileId);
  }, [projectId, mode, directProfileId, isCustomDirect, loadDiscovered]);

  useEffect(() => {
    if (!isIdeDirectMode(mode) || !directProfileId || isCustomDirect) return;
    const models = catalogModelsForDirect;
    if (models[0] && !models.some((item) => item.id === directModel)) {
      setDirectModel(models[0].id);
    }
  }, [mode, directProfileId, isCustomDirect, catalogModelsForDirect, directModel]);

  const workerPipeline = useMemo(() => {
    if (!isIdeWorkerMode(mode)) return null;
    const employee = employeeForIdeMode(mode);
    return pipelines.find((item) => item.employee === employee) ?? null;
  }, [mode, pipelines]);

  function stageMeta(binding: { modelProfileId: string; model: string } | undefined) {
    if (!binding?.modelProfileId || !binding.model) return null;
    const profile = profiles.find((item) => item.id === binding.modelProfileId);
    if (!profile) return { label: binding.model, bestAt: undefined, pricing: { label: '—' } };
    const free = profile.provider === 'custom' || profile.tier === 'local_remote';
    const catalogModels =
      profile.provider === 'custom'
        ? []
        : catalog.find((item) => item.id === profile.provider)?.models ?? [];
    const hit = catalogModels.find((item) => item.id === binding.model);
    return {
      company: companyDisplayName({ label: profile.label, provider: profile.provider }),
      label: hit?.label ?? binding.model,
      bestAt: hit?.bestAt,
      contextTokens: hit?.contextTokens ?? null,
      pricing: free ? { label: 'Free' } : hit?.pricing ?? { label: 'Pricing unknown' },
    };
  }

  useEffect(() => {
    if (!resizing) return;

    const clampWidth = (next: number) => {
      const max = Math.min(CHAT_MAX_WIDTH, Math.floor(window.innerWidth * 0.7));
      return Math.min(max, Math.max(CHAT_MIN_WIDTH, next));
    };

    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      onWidthChange(clampWidth(drag.startWidth + (drag.startX - event.clientX)));
    };

    const finish = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setResizing(false);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [resizing, onWidthChange]);

  function onResizePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: width,
    };
    setResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  async function send() {
    if (!projectId || !draft.trim() || busy || historyLoading) return;
    if (isIdeDirectMode(mode) && (!directProfileId || !directModel.trim())) {
      setError('Pick a company and model for Direct chat.');
      return;
    }
    const text = draft.trim();
    setDraft('');
    setBusy(true);
    setError('');
    const userTurn: ChatTurn = {
      requestId: crypto.randomUUID(),
      role: 'user',
      text,
    };
    setTurns((current) => [...current, userTurn]);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const generation = ++sendGenerationRef.current;

    try {
      const history = [...turns, userTurn]
        .filter((turn) => turn.role === 'user' || turn.role === 'assistant')
        .slice(-8)
        .map((turn) => ({ role: turn.role, text: turn.text }));
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai/ide/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          text,
          history,
          ...(isIdeDirectMode(mode)
            ? { modelProfileId: directProfileId, model: directModel }
            : {}),
        }),
        signal: controller.signal,
      });
      if (generation !== sendGenerationRef.current || controller.signal.aborted) return;
      const body = await response.json();
      if (generation !== sendGenerationRef.current || controller.signal.aborted) return;
      if (!response.ok) throw new Error(body.error ?? 'Chat request failed.');
      const turn = body.turn as ChatTurn;
      setTurns((current) => [...current, turn]);
    } catch (err) {
      if (generation !== sendGenerationRef.current) return;
      if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        setTurns((current) => [
          ...current,
          {
            requestId: crypto.randomUUID(),
            role: 'status',
            text: 'Stopped.',
          },
        ]);
        return;
      }
      setError(err instanceof Error ? err.message : 'Chat request failed.');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      if (generation === sendGenerationRef.current) setBusy(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  const canSendDirect = !isIdeDirectMode(mode) || Boolean(directProfileId && directModel.trim());

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l border-border bg-background-card"
      style={{ width }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize chat pane"
        aria-valuenow={Math.round(width)}
        aria-valuemin={CHAT_MIN_WIDTH}
        aria-valuemax={CHAT_MAX_WIDTH}
        tabIndex={0}
        className={`absolute inset-y-0 left-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize touch-none ${
          resizing ? 'bg-primary/50' : 'bg-transparent hover:bg-primary/30'
        }`}
        onPointerDown={onResizePointerDown}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            onWidthChange(Math.min(CHAT_MAX_WIDTH, width + 16));
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            onWidthChange(Math.max(CHAT_MIN_WIDTH, width - 16));
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-2">
        {ideChatModes.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onModeChange(item.id)}
            className={`rounded px-2 py-1 text-xs ${
              mode === item.id
                ? 'bg-primary text-white'
                : 'border border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onOpenRules}
          className="ml-auto rounded border border-border px-2 py-1 text-xs text-text-secondary"
        >
          Rules
        </button>
      </div>

      {isIdeDirectMode(mode) ? (
        <div className="space-y-2 border-b border-border px-2 py-2">
          <label className="block text-xs text-text-secondary">
            Company
            <select
              className={`${field} mt-1`}
              value={directProfileId}
              disabled={!projectId || busy}
              onChange={(event) => {
                setDirectProfileId(event.target.value);
                setDirectModel('');
              }}
            >
              <option value="">Select…</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {companyDisplayName({ label: profile.label, provider: profile.provider })}
                  {profile.tier === 'local_remote' ? ' (local)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-text-secondary">
            Model
            <select
              className={`${field} mt-1`}
              value={directModels.some((item) => item.id === directModel) ? directModel : ''}
              disabled={!projectId || busy || !directProfileId || discoverLoading || directModels.length === 0}
              onChange={(event) => setDirectModel(event.target.value)}
            >
              <option value="">{discoverLoading ? 'Loading…' : 'Select…'}</option>
              {directModels.map((item) => (
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
              directModel
                ? isCustomDirect || directCredential?.tier === 'local_remote'
                  ? { ...directMeta, pricing: { label: 'Free' } }
                  : directMeta
                : null
            }
          />
          {isCustomDirect && directProfileId ? (
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
              disabled={busy || discoverLoading || !projectId}
              onClick={() => projectId && void loadDiscovered(projectId, directProfileId)}
            >
              {discoverLoading ? 'Refreshing…' : 'Refresh models'}
            </button>
          ) : null}
          {discoverError ? <p className="text-[11px] text-text-secondary">{discoverError}</p> : null}
        </div>
      ) : (
        <div className="space-y-1 border-b border-border px-2 py-2 text-[11px] text-text-secondary">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="font-medium text-text-primary">Models for this worker</span>
            {projectId ? (
              <Link
                className="underline"
                href={`/workspace/ai-team?projectId=${encodeURIComponent(projectId)}&employee=${encodeURIComponent(
                  isIdeWorkerMode(mode) ? employeeForIdeMode(mode) : 'product'
                )}`}
              >
                Edit on AI Team
              </Link>
            ) : null}
          </div>
          {!workerPipeline ? (
            <p>No pipeline configured yet. Set Planner / Worker / Reviewer on AI Team.</p>
          ) : (
            (['planner', 'worker', 'reviewer'] as const).map((stage) => {
              const meta = stageMeta(workerPipeline[stage]);
              return (
                <p key={stage}>
                  <span className="capitalize text-text-primary">{stage}</span>
                  {': '}
                  {meta
                    ? `${meta.company} · ${meta.label}${meta.bestAt ? ` — ${meta.bestAt}` : ''} · ${meta.pricing.label}`
                    : 'Unassigned'}
                </p>
              );
            })
          )}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-auto p-3 text-sm">
        {turns.length === 0 && isIdeDirectMode(mode) ? (
          <p className="text-xs text-text-secondary">
            Direct mode chats with one company model (great for free/local low-level tasks).
          </p>
        ) : null}
        {turns.map((turn) => {
          const cost =
            turn.role === 'assistant' || turn.role === 'status'
              ? formatIdeCostUsd({
                  costMicros: turn.costMicros ?? null,
                  reservedMicros: turn.reservedMicros ?? null,
                  noProviderFee: turn.noProviderFee ?? false,
                })
              : null;
          return (
            <div
              key={turn.requestId}
              className={`rounded border px-2 py-2 ${
                turn.role === 'user'
                  ? 'border-border bg-background'
                  : turn.role === 'status'
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-border'
              }`}
            >
              <div className="mb-1 text-[10px] uppercase tracking-wide text-text-secondary">{turn.role}</div>
              <div className="whitespace-pre-wrap text-text-primary">{turn.text}</div>
              {turn.toolsUsed?.length ? (
                <div className="mt-1 text-[11px] text-text-secondary">
                  Tools: {turn.toolsUsed.join(', ')}
                </div>
              ) : null}
              {turn.artifacts?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {turn.artifacts.map((artifact) => (
                    <button
                      key={artifact.assetId}
                      type="button"
                      className="group relative max-w-full overflow-hidden rounded border border-border text-left"
                      onClick={() => setPreviewImage({ src: artifact.url, title: artifact.name })}
                      title="View full size"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={artifact.url}
                        alt={artifact.name}
                        className="max-h-40 max-w-full object-contain transition group-hover:opacity-90"
                      />
                      <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                        Full size
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              {cost && cost.amount !== '—' ? (
                <div className="mt-1 text-[11px] text-text-secondary">
                  {cost.label === 'reserved' ? 'Reserved ' : cost.label === 'no provider fee' ? '' : ''}
                  {cost.amount}
                  {cost.label === 'no provider fee' ? ' · no provider fee' : ''}
                  {cost.label === 'reserved' ? ' (usage unknown)' : ''}
                </div>
              ) : null}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {error ? <p className="px-3 text-xs text-red-500">{error}</p> : null}
      <div className="border-t border-border p-2">
        <textarea
          className="mb-2 h-20 w-full resize-none rounded border border-border bg-background p-2 text-sm text-text-primary"
          placeholder={projectId ? 'Message…' : 'Select a project first'}
          value={draft}
          disabled={!projectId || busy || historyLoading}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        {busy ? (
          <button type="button" className="w-full rounded border border-border px-3 py-2 text-sm" onClick={stop}>
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="w-full rounded border border-border px-3 py-2 text-sm disabled:opacity-50"
            disabled={!projectId || !draft.trim() || !canSendDirect || historyLoading}
            onClick={() => void send()}
          >
            {historyLoading ? 'Loading…' : 'Send'}
          </button>
        )}
      </div>
      <ImagePreviewModal
        isOpen={Boolean(previewImage)}
        src={previewImage?.src ?? null}
        title={previewImage?.title ?? 'Generated image'}
        onClose={() => setPreviewImage(null)}
        stackAboveLightbox
      />
    </aside>
  );
}
