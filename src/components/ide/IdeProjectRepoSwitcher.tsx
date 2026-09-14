'use client';

import { useEffect, useState } from 'react';

type ProjectOption = { id: string; name: string };

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

type Props = {
  projectId: string | null;
  onProjectChange: (projectId: string) => void;
  onRepositoryChange: (snapshot: RepositorySnapshot | null) => void;
};

export default function IdeProjectRepoSwitcher({ projectId, onProjectChange, onRepositoryChange }: Props) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [repository, setRepository] = useState<RepositorySnapshot | null>(null);
  const [error, setError] = useState('');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [installationId, setInstallationId] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/ai/team/projects', { cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'Unable to load projects.');
        if (cancelled) return;
        const list = (body.projects ?? []) as ProjectOption[];
        setProjects(list);
        if (!projectId && list[0]) onProjectChange(list[0].id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load projects.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, onProjectChange]);

  useEffect(() => {
    if (!projectId) {
      setRepository(null);
      onRepositoryChange(null);
      setEditing(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai/repository`, {
          cache: 'no-store',
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'Unable to load repository binding.');
        if (cancelled) return;
        setRepository(body);
        onRepositoryChange(body);
        if (body.repository) {
          setOwner(body.repository.owner);
          setRepo(body.repository.repo);
          setDefaultBranch(body.repository.defaultBranch);
          setInstallationId(body.repository.installationId ?? '');
          setEditing(!body.repository.installationId);
        } else {
          setOwner('');
          setRepo('');
          setDefaultBranch('main');
          setInstallationId('');
          setEditing(true);
        }
        setError('');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load repository.');
          setRepository(null);
          onRepositoryChange(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, onRepositoryChange]);

  async function saveBinding(event: React.FormEvent) {
    event.preventDefault();
    if (!projectId || !repository?.canManage) return;
    setSaving(true);
    setError('');
    try {
      const trimmedInstall = installationId.trim();
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai/repository`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: 'github',
          owner,
          repo,
          defaultBranch,
          publishMode: 'pull_request',
          installationId: trimmedInstall || null,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to save repository.');
      const next = {
        ...repository,
        repository: body.repository,
        connectionStatus: body.connectionStatus,
        githubAppConfigured: body.githubAppConfigured,
      };
      setRepository(next);
      onRepositoryChange(next);
      setInstallationId(body.repository?.installationId ?? '');
      setEditing(!body.repository?.installationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save repository.');
    } finally {
      setSaving(false);
    }
  }

  const repoLabel = repository?.repository
    ? `${repository.repository.owner}/${repository.repository.repo}@${repository.repository.defaultBranch}`
    : 'No repo linked';
  const needsInstall =
    Boolean(repository?.repository) && !repository?.repository?.installationId;
  const showForm = Boolean(projectId && repository && (editing || !repository.repository || needsInstall));

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="flex items-center gap-2 text-text-secondary">
        Project
        <select
          className="rounded border border-border bg-background px-2 py-1 text-text-primary"
          value={projectId ?? ''}
          onChange={(event) => onProjectChange(event.target.value)}
        >
          {projects.length === 0 ? <option value="">No projects</option> : null}
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      <span className="text-text-secondary truncate max-w-[18rem]" title={repoLabel}>
        {repoLabel}
        {needsInstall ? ' · needs installation ID' : ''}
      </span>
      {projectId && repository?.repository && repository.canManage ? (
        <button
          type="button"
          className="rounded border border-border px-2 py-0.5 text-xs text-text-secondary"
          onClick={() => setEditing((value) => !value)}
        >
          {editing ? 'Hide' : 'Edit binding'}
        </button>
      ) : null}
      {error ? <span className="text-red-500 text-xs">{error}</span> : null}
      {showForm ? (
        <form onSubmit={saveBinding} className="flex flex-wrap items-end gap-2 w-full mt-1">
          <p className="w-full text-xs text-text-secondary">
            Link owner/repo and paste the GitHub App <span className="text-text-primary">Installation ID</span>{' '}
            (from the install URL, e.g. github.com/settings/installations/<em>123456</em>). Server also needs{' '}
            <code className="text-[10px]">GITHUB_APP_ID</code> /{' '}
            <code className="text-[10px]">GITHUB_APP_PRIVATE_KEY</code>.
          </p>
          <input
            className="rounded border border-border bg-background px-2 py-1"
            placeholder="owner"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            disabled={!repository?.canManage || saving}
          />
          <input
            className="rounded border border-border bg-background px-2 py-1"
            placeholder="repo"
            value={repo}
            onChange={(event) => setRepo(event.target.value)}
            disabled={!repository?.canManage || saving}
          />
          <input
            className="rounded border border-border bg-background px-2 py-1 w-24"
            placeholder="branch"
            value={defaultBranch}
            onChange={(event) => setDefaultBranch(event.target.value)}
            disabled={!repository?.canManage || saving}
          />
          <input
            className="rounded border border-border bg-background px-2 py-1 w-36"
            placeholder="Installation ID"
            value={installationId}
            onChange={(event) => setInstallationId(event.target.value)}
            disabled={!repository?.canManage || saving}
            inputMode="numeric"
            autoComplete="off"
          />
          <button
            type="submit"
            className="rounded border border-border px-2 py-1 disabled:opacity-50"
            disabled={!repository?.canManage || saving || !owner || !repo}
          >
            {saving ? 'Saving…' : repository?.repository ? 'Save binding' : 'Link repo'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
