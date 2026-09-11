import { describe, expect, it } from 'vitest';
import {
  connectionStatus,
  evaluatePublishPreconditions,
  projectRepositorySchema,
  publishBlockMessages,
} from './githubPublish';

describe('projectRepositorySchema', () => {
  it('accepts a normalized GitHub binding', () => {
    expect(
      projectRepositorySchema.parse({
        owner: 'Acme-Org',
        repo: 'nucleas.app',
        defaultBranch: 'main',
      })
    ).toMatchObject({
      host: 'github',
      publishMode: 'pull_request',
      owner: 'Acme-Org',
      repo: 'nucleas.app',
    });
  });

  it.each([
    { owner: '' },
    { repo: 'bad repo' },
    { defaultBranch: '' },
    { publishMode: 'direct_push' },
    { host: 'gitlab' },
  ])('rejects invalid binding %o', (patch) => {
    expect(
      projectRepositorySchema.safeParse({
        owner: 'acme',
        repo: 'app',
        defaultBranch: 'main',
        ...patch,
      }).success
    ).toBe(false);
  });
});

describe('evaluatePublishPreconditions', () => {
  const ready = {
    accepted: true,
    executionVerified: true,
    hasRepository: true,
    githubConfigured: true,
    installationConnected: true,
  };

  it('allows publish only when every gate passes', () => {
    expect(evaluatePublishPreconditions(ready)).toEqual({ ok: true });
  });

  it.each([
    [{ accepted: false }, 'review_not_accepted'],
    [{ executionVerified: false }, 'execution_unverified'],
    [{ hasRepository: false }, 'repository_missing'],
    [{ githubConfigured: false }, 'github_not_configured'],
    [{ installationConnected: false }, 'awaiting_app_install'],
  ] as const)('blocks %j', (patch, reason) => {
    expect(evaluatePublishPreconditions({ ...ready, ...patch })).toEqual({
      ok: false,
      reason,
    });
    expect(publishBlockMessages[reason].length).toBeGreaterThan(10);
  });
});

describe('connectionStatus', () => {
  it('reports awaiting install without a binding', () => {
    expect(connectionStatus({ hasBinding: false })).toBe('awaiting_app_install');
  });
});
