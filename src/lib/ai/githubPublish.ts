import { z } from 'zod';

const githubName = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_.-]+$/, 'Use letters, numbers, dots, underscores, or hyphens.');

export const projectRepositorySchema = z
  .object({
    host: z.literal('github').default('github'),
    owner: githubName,
    repo: githubName,
    defaultBranch: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[A-Za-z0-9._/-]+$/, 'Invalid default branch name.')
      .default('main'),
    publishMode: z.literal('pull_request').default('pull_request'),
    installationId: z.string().trim().min(1).max(64).nullable().optional(),
  })
  .strict();

export type ProjectRepositoryInput = z.infer<typeof projectRepositorySchema>;

export type RepositoryConnectionStatus =
  | 'configured'
  | 'awaiting_app_install'
  | 'github_not_configured';

export type PublishBlockReason =
  | 'review_not_accepted'
  | 'execution_unverified'
  | 'repository_missing'
  | 'github_not_configured'
  | 'awaiting_app_install'
  | 'publish_unavailable';

export const publishBlockMessages: Record<PublishBlockReason, string> = {
  review_not_accepted: 'Accept the exact reviewed artifact before opening a pull request.',
  execution_unverified:
    'Sandbox execution evidence has not been verified. Opening a pull request is blocked.',
  repository_missing: 'Link a GitHub repository on this project before publishing.',
  github_not_configured:
    'GitHub App credentials are not configured on the server. Repository binding is saved; publish stays blocked.',
  awaiting_app_install:
    'Install and connect the GitHub App for this repository before opening a pull request.',
  publish_unavailable: 'Pull request publishing is temporarily unavailable.',
};

export function githubAppConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_APP_ID?.trim() &&
      process.env.GITHUB_APP_PRIVATE_KEY?.trim()
  );
}

export function connectionStatus(input: {
  hasBinding: boolean;
  installationId?: string | null;
}): RepositoryConnectionStatus {
  if (!input.hasBinding) return 'awaiting_app_install';
  if (!githubAppConfigured()) return 'github_not_configured';
  if (!input.installationId) return 'awaiting_app_install';
  return 'configured';
}

export function evaluatePublishPreconditions(input: {
  accepted: boolean;
  executionVerified: boolean;
  hasRepository: boolean;
  githubConfigured: boolean;
  installationConnected: boolean;
}): { ok: true } | { ok: false; reason: PublishBlockReason } {
  if (!input.accepted) return { ok: false, reason: 'review_not_accepted' };
  if (!input.executionVerified) return { ok: false, reason: 'execution_unverified' };
  if (!input.hasRepository) return { ok: false, reason: 'repository_missing' };
  if (!input.githubConfigured) return { ok: false, reason: 'github_not_configured' };
  if (!input.installationConnected) return { ok: false, reason: 'awaiting_app_install' };
  return { ok: true };
}
