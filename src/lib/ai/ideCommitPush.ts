import 'server-only';
import type { Octokit } from '@octokit/rest';
import { AiHttpError } from '@/lib/ai/control/access';
import { createInstallationOctokit } from '@/lib/ai/githubAppClient';
import { githubAppConfigured, publishBlockMessages } from '@/lib/ai/githubPublish';
import {
  type IdeCommitPushInput,
  ideRepoPathSchema,
} from '@/lib/ai/idePublishSchema';
import { AiProjectRepository } from '@/lib/models/AiProjectRepository';
import type { Types } from 'mongoose';

export { ideCommitPushSchema, type IdeCommitPushInput } from '@/lib/ai/idePublishSchema';

export type IdePublishResult =
  | {
      status: 'pushed';
      commitSha: string;
      branch: string;
      repository: { owner: string; repo: string; defaultBranch: string };
      commitUrl: string;
    }
  | {
      status: 'blocked';
      reason: string;
      commitSha: null;
      repository: { owner: string; repo: string; defaultBranch: string } | null;
    };

async function loadBoundRepo(organizationId: string, projectId: Types.ObjectId) {
  const repository = await AiProjectRepository.findOne({ organizationId, projectId })
    .select('owner repo defaultBranch installationId')
    .maxTimeMS(3000)
    .lean();
  return repository;
}

export async function getIdeRepositoryAccess(organizationId: string, projectId: Types.ObjectId): Promise<
  | { ok: true; octokit: Octokit; owner: string; repo: string; defaultBranch: string; installationId: string }
  | { ok: false; reason: string; repository: { owner: string; repo: string; defaultBranch: string } | null }
> {
  const repository = await loadBoundRepo(organizationId, projectId);
  if (!repository) {
    return { ok: false, reason: publishBlockMessages.repository_missing, repository: null };
  }
  if (!githubAppConfigured()) {
    return {
      ok: false,
      reason: publishBlockMessages.github_not_configured,
      repository: {
        owner: repository.owner,
        repo: repository.repo,
        defaultBranch: repository.defaultBranch,
      },
    };
  }
  if (!repository.installationId) {
    return {
      ok: false,
      reason: publishBlockMessages.awaiting_app_install,
      repository: {
        owner: repository.owner,
        repo: repository.repo,
        defaultBranch: repository.defaultBranch,
      },
    };
  }
  try {
    const octokit = createInstallationOctokit(repository.installationId);
    return {
      ok: true,
      octokit,
      owner: repository.owner,
      repo: repository.repo,
      defaultBranch: repository.defaultBranch,
      installationId: repository.installationId,
    };
  } catch {
    return {
      ok: false,
      reason: publishBlockMessages.github_not_configured,
      repository: {
        owner: repository.owner,
        repo: repository.repo,
        defaultBranch: repository.defaultBranch,
      },
    };
  }
}

/** List directory entries at path (empty string = repo root) on the default branch. */
export async function listIdeTree(
  organizationId: string,
  projectId: Types.ObjectId,
  path = ''
): Promise<
  | { ok: true; branch: string; entries: { name: string; path: string; type: 'file' | 'dir'; sha: string }[] }
  | { ok: false; reason: string }
> {
  const access = await getIdeRepositoryAccess(organizationId, projectId);
  if (!access.ok) return { ok: false, reason: access.reason };
  const normalized = path.trim().replace(/^\/+|\/+$/g, '');
  try {
    const { data } = await access.octokit.repos.getContent({
      owner: access.owner,
      repo: access.repo,
      path: normalized || '',
      ref: access.defaultBranch,
    });
    if (!Array.isArray(data)) {
      return { ok: false, reason: 'Path is a file, not a directory.' };
    }
    const entries = data
      .map((item) => ({
        name: item.name,
        path: item.path,
        type: (item.type === 'dir' ? 'dir' : 'file') as 'file' | 'dir',
        sha: item.sha,
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    return { ok: true, branch: access.defaultBranch, entries };
  } catch {
    return { ok: false, reason: 'Unable to read the repository tree from GitHub.' };
  }
}

/** Fetch UTF-8 text file content from the default branch. Binary / oversized files fail closed. */
export async function readIdeFile(
  organizationId: string,
  projectId: Types.ObjectId,
  path: string
): Promise<
  | { ok: true; path: string; branch: string; content: string; sha: string }
  | { ok: false; reason: string }
> {
  const parsed = ideRepoPathSchema.safeParse(path);
  if (!parsed.success) return { ok: false, reason: 'Invalid file path.' };
  const access = await getIdeRepositoryAccess(organizationId, projectId);
  if (!access.ok) return { ok: false, reason: access.reason };
  try {
    const { data } = await access.octokit.repos.getContent({
      owner: access.owner,
      repo: access.repo,
      path: parsed.data,
      ref: access.defaultBranch,
    });
    if (Array.isArray(data) || data.type !== 'file' || !('content' in data) || typeof data.content !== 'string') {
      return { ok: false, reason: 'Path is not a readable text file.' };
    }
    if (data.size != null && data.size > 500_000) {
      return { ok: false, reason: 'File is too large to open in the IDE.' };
    }
    const content = Buffer.from(data.content, data.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8');
    if (content.includes('\u0000')) {
      return { ok: false, reason: 'Binary files cannot be opened in the IDE editor.' };
    }
    return { ok: true, path: parsed.data, branch: access.defaultBranch, content, sha: data.sha };
  } catch {
    return { ok: false, reason: 'Unable to read the file from GitHub.' };
  }
}

/**
 * Commit and push file changes directly to the repository default branch after one human confirm.
 * Never invents commit SHAs or URLs on failure.
 */
export async function commitAndPushToDefaultBranch(
  organizationId: string,
  projectId: Types.ObjectId,
  input: IdeCommitPushInput
): Promise<IdePublishResult> {
  if (input.confirm !== true) {
    throw new AiHttpError(400, 'Explicit confirm is required to commit and push.');
  }
  const access = await getIdeRepositoryAccess(organizationId, projectId);
  if (!access.ok) {
    return { status: 'blocked', reason: access.reason, commitSha: null, repository: access.repository };
  }

  const { octokit, owner, repo, defaultBranch } = access;
  const repository = { owner, repo, defaultBranch };

  try {
    // Optimistic concurrency check (F10): ensure no file has been modified since loaded
    for (const file of input.files) {
      if (file.expectedSha) {
        try {
          const existing = await octokit.repos.getContent({
            owner,
            repo,
            path: file.path,
            ref: defaultBranch,
          });
          const currentSha =
            Array.isArray(existing.data) || !('sha' in existing.data)
              ? null
              : (existing.data as { sha: string }).sha;
          if (currentSha && currentSha !== file.expectedSha) {
            return {
              status: 'blocked',
              reason: `Conflict: ${file.path} has been modified since it was loaded. Reload the file and review changes before publishing.`,
              commitSha: null,
              repository,
            };
          }
        } catch (err) {
          const status =
            err && typeof err === 'object' && 'status' in err ? Number(err.status) : 0;
          if (status !== 404) {
            // Re-throw unexpected GitHub errors
            throw err;
          }
        }
      }
    }

    const ref = await octokit.git.getRef({ owner, repo, ref: `heads/${defaultBranch}` });
    const baseSha = ref.data.object.sha;
    const baseCommit = await octokit.git.getCommit({ owner, repo, commit_sha: baseSha });
    const baseTreeSha = baseCommit.data.tree.sha;

    const tree = await Promise.all(
      input.files.map(async (file) => {
        const blob = await octokit.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.content, 'utf8').toString('base64'),
          encoding: 'base64',
        });
        return {
          path: file.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.data.sha,
        };
      })
    );

    const newTree = await octokit.git.createTree({
      owner,
      repo,
      base_tree: baseTreeSha,
      tree,
    });
    const commit = await octokit.git.createCommit({
      owner,
      repo,
      message: input.message,
      tree: newTree.data.sha,
      parents: [baseSha],
    });
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
      sha: commit.data.sha,
    });

    return {
      status: 'pushed',
      commitSha: commit.data.sha,
      branch: defaultBranch,
      repository,
      commitUrl: commit.data.html_url,
    };
  } catch {
    return {
      status: 'blocked',
      reason: 'GitHub rejected the commit or push. No commit SHA was recorded.',
      commitSha: null,
      repository,
    };
  }
}
