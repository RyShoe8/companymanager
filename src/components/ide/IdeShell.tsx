'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import IdeChatPane from '@/components/ide/IdeChatPane';
import IdeEditor from '@/components/ide/IdeEditor';
import IdeFileTree from '@/components/ide/IdeFileTree';
import IdePlanPane from '@/components/ide/IdePlanPane';
import IdeProjectRepoSwitcher from '@/components/ide/IdeProjectRepoSwitcher';
import IdePublishApproval from '@/components/ide/IdePublishApproval';
import IdeRunScene from '@/components/ide/IdeRunScene';
import IdeTaskRulesPanel from '@/components/ide/IdeTaskRulesPanel';
import type { IdeChatMode } from '@/lib/ide/modes';
import type { IdePlanDocument, IdeRunActivity } from '@/lib/ide/idePlan';
import {
  readStoredIdeChatMode,
  writeStoredIdeChatMode,
} from '@/lib/ide/chatSelectionStorage';
import { runSceneFromState } from '@/lib/ide/runScenePhases';
import { microsToDollars } from '@/lib/ai/settingsSchema';

type TreeEntry = { name: string; path: string; type: 'file' | 'dir'; sha: string };

type RepositorySnapshot = {
  repository: {
    owner: string;
    repo: string;
    defaultBranch: string;
    installationId: string | null;
  } | null;
  connectionStatus: string;
  githubAppConfigured: boolean;
  canManage: boolean;
};

type SpendSnapshot = {
  dailyEstimatedMicros: number;
  monthlyEstimatedMicros: number;
};

function formatSpend(micros: number): string {
  return `$${microsToDollars(micros)}`;
}

export default function IdeShell({ initialProjectId }: { initialProjectId?: string }) {
  const [projectId, setProjectId] = useState<string | null>(initialProjectId ?? null);
  const [repository, setRepository] = useState<RepositorySnapshot | null>(null);
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [rootEntries, setRootEntries] = useState<TreeEntry[]>([]);
  const [childrenByPath, setChildrenByPath] = useState<Record<string, TreeEntry[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});
  const [loadingPaths, setLoadingPaths] = useState<Record<string, boolean>>({});
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeReason, setTreeReason] = useState<string | null>(null);
  const [treeBranch, setTreeBranch] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [mode, setMode] = useState<IdeChatMode>('engineering');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(352);
  const [centerView, setCenterView] = useState<'file' | 'plan'>('file');
  const [activePlan, setActivePlan] = useState<IdePlanDocument | null>(null);
  const [spend, setSpend] = useState<SpendSnapshot | null>(null);
  const [runActivity, setRunActivity] = useState<IdeRunActivity>(() =>
    runSceneFromState({ busy: false, interactionMode: 'chat' })
  );
  const approvePlanRef = useRef<((plan: IdePlanDocument) => void) | null>(null);
  const rejectPlanRef = useRef<(() => void) | null>(null);
  const prevBusyRef = useRef(false);
  const expandedPathsRef = useRef(expandedPaths);
  expandedPathsRef.current = expandedPaths;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('nucleas.ide.chatWidth');
      if (!stored) return;
      const parsed = Number(stored);
      if (Number.isFinite(parsed) && parsed >= 280 && parsed <= 720) {
        setChatWidth(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!projectId) return;
    const stored = readStoredIdeChatMode(projectId);
    if (stored) setMode(stored);
  }, [projectId]);

  const onModeChange = useCallback(
    (next: IdeChatMode) => {
      setMode(next);
      if (projectId) writeStoredIdeChatMode(projectId, next);
    },
    [projectId]
  );

  const onChatWidthChange = useCallback((next: number) => {
    setChatWidth(next);
    try {
      window.localStorage.setItem('nucleas.ide.chatWidth', String(Math.round(next)));
    } catch {
      /* ignore */
    }
  }, []);

  const onPlanReady = useCallback((plan: IdePlanDocument | null) => {
    setActivePlan(plan);
    if (plan) setCenterView('plan');
  }, []);

  const onRunActivity = useCallback((activity: IdeRunActivity) => {
    setRunActivity(activity);
  }, []);

  const dirty = activePath != null && fileContent !== originalContent;
  const hasBinding = Boolean(repository?.repository);

  const fetchTreePath = useCallback(
    async (path: string): Promise<TreeEntry[] | null> => {
      if (!projectId || !hasBinding) return null;
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/ai/ide/tree?path=${encodeURIComponent(path)}`,
        { cache: 'no-store' }
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to load tree.');
      if (!body.ok) {
        throw new Error(body.reason ?? 'Unable to load tree.');
      }
      if (path === '') {
        setTreeBranch(body.branch ?? null);
      }
      return (body.entries ?? []) as TreeEntry[];
    },
    [projectId, hasBinding]
  );

  const loadRoot = useCallback(async () => {
    if (!projectId || !hasBinding) {
      setRootEntries([]);
      setChildrenByPath({});
      setExpandedPaths({});
      setLoadingPaths({});
      setTreeReason(
        hasBinding
          ? null
          : 'Link a GitHub repository to load the file tree. Server GitHub App credentials and an installation are required for live files.'
      );
      setTreeBranch(null);
      return;
    }
    setTreeLoading(true);
    try {
      const entries = await fetchTreePath('');
      setRootEntries(entries ?? []);
      setTreeReason(null);
    } catch (error) {
      setRootEntries([]);
      setTreeReason(error instanceof Error ? error.message : 'Unable to load tree.');
      setTreeBranch(null);
    } finally {
      setTreeLoading(false);
    }
  }, [projectId, hasBinding, fetchTreePath]);

  const refreshExpanded = useCallback(async () => {
    const paths = Object.keys(expandedPathsRef.current).filter((path) => expandedPathsRef.current[path]);
    if (!paths.length) {
      await loadRoot();
      return;
    }
    await loadRoot();
    const nextChildren: Record<string, TreeEntry[]> = {};
    await Promise.all(
      paths.map(async (path) => {
        try {
          const entries = await fetchTreePath(path);
          if (entries) nextChildren[path] = entries;
        } catch {
          /* leave missing; user can re-expand */
        }
      })
    );
    setChildrenByPath((current) => ({ ...current, ...nextChildren }));
  }, [loadRoot, fetchTreePath]);

  const toggleDir = useCallback(
    async (path: string) => {
      const isOpen = Boolean(expandedPathsRef.current[path]);
      if (isOpen) {
        setExpandedPaths((current) => {
          const next = { ...current };
          delete next[path];
          return next;
        });
        return;
      }
      setExpandedPaths((current) => ({ ...current, [path]: true }));
      if (childrenByPath[path]) return;
      setLoadingPaths((current) => ({ ...current, [path]: true }));
      try {
        const entries = await fetchTreePath(path);
        if (entries) {
          setChildrenByPath((current) => ({ ...current, [path]: entries }));
          setTreeReason(null);
        }
      } catch (error) {
        setExpandedPaths((current) => {
          const next = { ...current };
          delete next[path];
          return next;
        });
        setTreeReason(error instanceof Error ? error.message : 'Unable to load folder.');
      } finally {
        setLoadingPaths((current) => {
          const next = { ...current };
          delete next[path];
          return next;
        });
      }
    },
    [childrenByPath, fetchTreePath]
  );

  const loadSpend = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(id)}/ai/ide/spend`, {
        cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to load spend.');
      setSpend({
        dailyEstimatedMicros: Number(body.dailyEstimatedMicros) || 0,
        monthlyEstimatedMicros: Number(body.monthlyEstimatedMicros) || 0,
      });
    } catch {
      setSpend(null);
    }
  }, []);

  useEffect(() => {
    setActivePath(null);
    setFileContent('');
    setOriginalContent('');
    setActivePlan(null);
    setCenterView('file');
    setChildrenByPath({});
    setExpandedPaths({});
    setLoadingPaths({});
    void loadRoot();
  }, [projectId, hasBinding, loadRoot]);

  useEffect(() => {
    if (!projectId) {
      setSpend(null);
      return;
    }
    void loadSpend(projectId);
  }, [projectId, loadSpend]);

  useEffect(() => {
    const wasBusy = prevBusyRef.current;
    prevBusyRef.current = runActivity.busy;
    if (wasBusy && !runActivity.busy && projectId) {
      void loadSpend(projectId);
    }
  }, [runActivity.busy, projectId, loadSpend]);

  async function openFile(path: string) {
    if (!projectId) return;
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/ai/ide/file?path=${encodeURIComponent(path)}`,
        { cache: 'no-store' }
      );
      const body = await response.json();
      if (!response.ok || !body.ok) {
        setTreeReason(body.reason ?? body.error ?? 'Unable to open file.');
        return;
      }
      setActivePath(body.path);
      setFileContent(body.content ?? '');
      setOriginalContent(body.content ?? '');
      setCenterView('file');
    } catch (error) {
      setTreeReason(error instanceof Error ? error.message : 'Unable to open file.');
    }
  }

  function rejectPlan() {
    rejectPlanRef.current?.();
    setActivePlan(null);
    setCenterView('file');
  }

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden bg-background">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2">
        <h1 className="text-sm font-semibold text-text-primary">IDE</h1>
        <IdeProjectRepoSwitcher
          projectId={projectId}
          onProjectChange={setProjectId}
          onRepositoryChange={setRepository}
        />
        {activePlan ? (
          <button
            type="button"
            className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
            onClick={() => setCenterView((current) => (current === 'plan' ? 'file' : 'plan'))}
          >
            {centerView === 'plan' ? 'Show file' : 'Show plan'}
          </button>
        ) : null}
        {spend ? (
          <p className="font-mono text-[11px] text-text-secondary" title="Estimated project AI spend (UTC)">
            Today {formatSpend(spend.dailyEstimatedMicros)} · Month {formatSpend(spend.monthlyEstimatedMicros)}
          </p>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <IdeFileTree
          collapsed={treeCollapsed}
          onToggle={() => setTreeCollapsed((value) => !value)}
          rootEntries={rootEntries}
          childrenByPath={childrenByPath}
          expandedPaths={expandedPaths}
          loadingPaths={loadingPaths}
          loading={treeLoading}
          reason={treeReason}
          branch={treeBranch}
          activePath={activePath}
          onOpenFile={(path) => void openFile(path)}
          onToggleDir={(path) => void toggleDir(path)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col">
            {centerView === 'plan' && activePlan ? (
              <IdePlanPane
                plan={activePlan}
                approveDisabled={runActivity.busy}
                onChange={setActivePlan}
                onReject={rejectPlan}
                onApprove={() => {
                  if (!activePlan) return;
                  approvePlanRef.current?.(activePlan);
                }}
              />
            ) : (
              <>
                <IdeEditor
                  path={activePath}
                  content={fileContent}
                  dirty={dirty}
                  readOnlyReason={null}
                  onChange={setFileContent}
                />
                <IdePublishApproval
                  projectId={projectId}
                  canPublish={Boolean(repository?.canManage)}
                  path={activePath}
                  originalContent={originalContent}
                  content={fileContent}
                  dirty={dirty}
                  onPublished={() => {
                    if (activePath) {
                      setOriginalContent(fileContent);
                      void refreshExpanded();
                    }
                  }}
                />
              </>
            )}
          </div>
          <IdeRunScene activity={runActivity} />
        </div>
        <IdeChatPane
          projectId={projectId}
          mode={mode}
          onModeChange={onModeChange}
          onOpenRules={() => setRulesOpen(true)}
          width={chatWidth}
          onWidthChange={onChatWidthChange}
          onPlanReady={onPlanReady}
          onRunActivity={onRunActivity}
          approvePlanRef={approvePlanRef}
          rejectPlanRef={rejectPlanRef}
        />
      </div>
      <IdeTaskRulesPanel projectId={projectId} open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
