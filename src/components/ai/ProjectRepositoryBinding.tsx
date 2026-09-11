'use client';

import { useCallback, useEffect, useState } from 'react';

const field = 'w-full rounded border border-border bg-background p-2 text-text-primary';
const button = 'rounded border border-border px-3 py-2 text-sm disabled:opacity-50';

type RepositorySnapshot = {
  repository: {
    host: string;
    owner: string;
    repo: string;
    defaultBranch: string;
    publishMode: string;
    installationId: string | null;
  } | null;
  connectionStatus: string;
  githubAppConfigured: boolean;
  canManage: boolean;
};

const statusCopy: Record<string, string> = {
  configured: 'GitHub App connection is ready for pull-request publish when artifacts are verified.',
  awaiting_app_install:
    'Repository path is saved. A GitHub App installation is still required before publish can succeed.',
  github_not_configured:
    'Repository path is saved. Server GitHub App credentials are not configured, so publish stays blocked.',
};

export default function ProjectRepositoryBinding({ projectId }: { projectId: string }) {
  const [data, setData] = useState<RepositorySnapshot | null>(null);
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const endpoint = `/api/projects/${encodeURIComponent(projectId)}/ai/repository`;

  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? 'Unable to load repository binding.');
    setData(body);
    if (body.repository) {
      setOwner(body.repository.owner);
      setRepo(body.repository.repo);
      setDefaultBranch(body.repository.defaultBranch);
    }
  }, [endpoint]);

  useEffect(() => {
    void load().catch((error) => {
      setMessage(error instanceof Error ? error.message : 'Unable to load repository binding.');
    });
  }, [load]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!data?.canManage) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: 'github',
          owner,
          repo,
          defaultBranch,
          publishMode: 'pull_request',
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Unable to save repository binding.');
      setData((current) =>
        current
          ? {
              ...current,
              repository: body.repository,
              connectionStatus: body.connectionStatus,
              githubAppConfigured: body.githubAppConfigured,
            }
          : current
      );
      setMessage('Repository binding saved. Publish remains fail-closed until verification and GitHub App setup are complete.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded border border-border p-4">
      <h2 className="text-lg font-semibold">GitHub repository</h2>
      <p className="text-sm text-text-secondary">
        Link the code repository for this project. Accepted, sandbox-verified artifacts can open a pull request
        later. This does not clone files into Nucleas or write to your laptop.
      </p>
      {data && (
        <p className="text-sm" role="status">
          {statusCopy[data.connectionStatus] ?? data.connectionStatus}
          {!data.githubAppConfigured ? ' Server env: GitHub App not configured.' : ''}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <form className="grid gap-3 sm:grid-cols-3" onSubmit={(event) => void save(event)}>
        <label className="text-sm">
          Owner
          <input
            className={`${field} mt-1`}
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            required
            maxLength={100}
            disabled={busy || data?.canManage === false}
            placeholder="org-or-user"
          />
        </label>
        <label className="text-sm">
          Repository
          <input
            className={`${field} mt-1`}
            value={repo}
            onChange={(event) => setRepo(event.target.value)}
            required
            maxLength={100}
            disabled={busy || data?.canManage === false}
            placeholder="repo-name"
          />
        </label>
        <label className="text-sm">
          Default branch
          <input
            className={`${field} mt-1`}
            value={defaultBranch}
            onChange={(event) => setDefaultBranch(event.target.value)}
            required
            maxLength={200}
            disabled={busy || data?.canManage === false}
          />
        </label>
        {data?.canManage ? (
          <button className={`${button} sm:col-span-3`} disabled={busy}>
            {busy ? 'Saving…' : 'Save repository binding'}
          </button>
        ) : (
          <p className="text-sm text-text-secondary sm:col-span-3">Only managers can edit the repository binding.</p>
        )}
      </form>
      <p className="text-xs text-text-secondary">
        Publish mode: pull request only. After a PR merges, sync local clones with git pull.
      </p>
    </section>
  );
}
