'use client';

import { useCallback, useEffect, useState } from 'react';
import IdeChatPane from '@/components/ide/IdeChatPane';
import IdeEditor from '@/components/ide/IdeEditor';
import IdeFileTree from '@/components/ide/IdeFileTree';
import IdeProjectRepoSwitcher from '@/components/ide/IdeProjectRepoSwitcher';
import IdePublishApproval from '@/components/ide/IdePublishApproval';
import IdeTaskRulesPanel from '@/components/ide/IdeTaskRulesPanel';
import type { IdeChatMode } from '@/lib/ide/modes';

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

export default function IdeShell({ initialProjectId }: { initialProjectId?: string }) {
  const [projectId, setProjectId] = useState<string | null>(initialProjectId ?? null);
  const [repository, setRepository] = useState<RepositorySnapshot | null>(null);
  const [treeCollapsed, setTreeCollapsed] = useState(false);
  const [dirPath, setDirPath] = useState('');
  const [entries, setEntries] = useState<TreeEntry[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeReason, setTreeReason] = useState<string | null>(null);
  const [treeBranch, setTreeBranch] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [mode, setMode] = useState<IdeChatMode>('engineering');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(352);

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

  const onChatWidthChange = useCallback((next: number) => {
    setChatWidth(next);
    try {
      window.localStorage.setItem('nucleas.ide.chatWidth', String(Math.round(next)));
    } catch {
      /* ignore */
    }
  }, []);

  const dirty = activePath != null && fileContent !== originalContent;
  const hasBinding = Boolean(repository?.repository);

  const loadTree = useCallback(
    async (path: string) => {
      if (!projectId || !hasBinding) {
        setEntries([]);
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
        const response = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/ai/ide/tree?path=${encodeURIComponent(path)}`,
          { cache: 'no-store' }
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'Unable to load tree.');
        if (!body.ok) {
          setEntries([]);
          setTreeReason(body.reason ?? 'Unable to load tree.');
          setTreeBranch(null);
        } else {
          setEntries(body.entries ?? []);
          setTreeReason(null);
          setTreeBranch(body.branch ?? null);
        }
      } catch (error) {
        setEntries([]);
        setTreeReason(error instanceof Error ? error.message : 'Unable to load tree.');
        setTreeBranch(null);
      } finally {
        setTreeLoading(false);
      }
    },
    [projectId, hasBinding]
  );

  useEffect(() => {
    setDirPath('');
    setActivePath(null);
    setFileContent('');
    setOriginalContent('');
    void loadTree('');
  }, [projectId, hasBinding, loadTree]);

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
    } catch (error) {
      setTreeReason(error instanceof Error ? error.message : 'Unable to open file.');
    }
  }

  function openDir(path: string) {
    setDirPath(path);
    void loadTree(path);
  }

  function goUp() {
    if (!dirPath) return;
    const parts = dirPath.split('/').filter(Boolean);
    parts.pop();
    const next = parts.join('/');
    setDirPath(next);
    void loadTree(next);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2">
        <h1 className="text-sm font-semibold text-text-primary">IDE</h1>
        <IdeProjectRepoSwitcher
          projectId={projectId}
          onProjectChange={setProjectId}
          onRepositoryChange={setRepository}
        />
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <IdeFileTree
          collapsed={treeCollapsed}
          onToggle={() => setTreeCollapsed((value) => !value)}
          entries={entries}
          loading={treeLoading}
          reason={treeReason}
          branch={treeBranch}
          activePath={activePath}
          onOpenFile={(path) => void openFile(path)}
          onOpenDir={openDir}
          breadcrumb={dirPath}
          onGoUp={goUp}
        />
        <div className="flex min-w-0 flex-1 flex-col">
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
                void loadTree(dirPath);
              }
            }}
          />
        </div>
        <IdeChatPane
          projectId={projectId}
          mode={mode}
          onModeChange={setMode}
          onOpenRules={() => setRulesOpen(true)}
          width={chatWidth}
          onWidthChange={onChatWidthChange}
        />
      </div>
      <IdeTaskRulesPanel projectId={projectId} open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}
