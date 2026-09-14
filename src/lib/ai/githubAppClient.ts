import 'server-only';
import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { githubAppConfigured } from '@/lib/ai/githubPublish';

function normalizePrivateKey(raw: string): string {
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

/** Build an Octokit client for a GitHub App installation. Fail-closed when env/install missing. */
export function createInstallationOctokit(installationId: string): Octokit {
  if (!githubAppConfigured()) {
    throw new Error('GitHub App credentials are not configured.');
  }
  const appId = process.env.GITHUB_APP_ID!.trim();
  const privateKey = normalizePrivateKey(process.env.GITHUB_APP_PRIVATE_KEY!.trim());
  const installationIdNumber = Number(installationId);
  if (!Number.isFinite(installationIdNumber) || installationIdNumber <= 0) {
    throw new Error('Invalid GitHub App installation id.');
  }
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
      installationId: installationIdNumber,
    },
  });
}
