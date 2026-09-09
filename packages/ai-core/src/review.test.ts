import { describe, expect, it } from 'vitest';
import { assertArtifactAcceptance } from './review';
import { artifactReviewSchema } from '../../ai-contracts/src/review';
const binding = { organizationId: 'org', projectId: '1'.repeat(24), taskId: '2'.repeat(24), runId: '3'.repeat(24),
  repositoryCommit: 'a'.repeat(40), artifactDigest: 'b'.repeat(64), policyDigest: 'c'.repeat(64), criteriaDigest: 'd'.repeat(64) };
const review = { protocolVersion: 1, reviewId: '4'.repeat(24), binding, workerIdentityId: '5'.repeat(24),
  reviewerIdentityId: '6'.repeat(24), verdict: 'passed', evidenceDigests: ['e'.repeat(64)], findings: [],
  reviewedAt: '2026-09-06T10:00:00Z', expiresAt: '2026-09-07T10:00:00Z' };
const acceptance = { protocolVersion: 1, reviewId: review.reviewId, binding, acceptedByUserId: '7'.repeat(24),
  acceptedAt: '2026-09-06T11:00:00Z', consumed: false };
const input = { currentBinding: binding, review, acceptance, authorizedHumanUserId: acceptance.acceptedByUserId,
  authorizedReviewerIdentityId: review.reviewerIdentityId, workerIdentityId: review.workerIdentityId };
const now = new Date('2026-09-06T12:00:00Z');
describe('exact reviewed artifact acceptance', () => {
  it('accepts matching current evidence and a separate reviewer', () => {
    expect(assertArtifactAcceptance(input, now).binding).toEqual(binding);
  });
  it.each(Object.keys(binding) as Array<keyof typeof binding>)('rejects changed %s', key => {
    const value = key === 'organizationId' ? 'other' : key === 'repositoryCommit' ? 'f'.repeat(40) : key.endsWith('Digest') ? 'f'.repeat(64) : 'f'.repeat(24);
    expect(() => assertArtifactAcceptance({ ...input, currentBinding: { ...binding, [key]: value } }, now)).toThrow();
  });
  it.each(['authorizedHumanUserId', 'authorizedReviewerIdentityId', 'workerIdentityId'] as const)('requires the authorized %s', key => {
    expect(() => assertArtifactAcceptance({ ...input, [key]: '9'.repeat(24) }, now)).toThrow();
  });
  it('rejects replay, wrong review, expired review and future decisions', () => {
    for (const change of [{ consumed: true }, { reviewId: '9'.repeat(24) }, { acceptedAt: '2026-09-06T13:00:00Z' }, { acceptedAt: '2026-09-06T09:00:00Z' }]) {
      expect(() => assertArtifactAcceptance({ ...input, acceptance: { ...acceptance, ...change } }, now)).toThrow();
    }
    expect(() => assertArtifactAcceptance(input, new Date(review.expiresAt))).toThrow();
    expect(() => assertArtifactAcceptance(input, new Date('invalid'))).toThrow();
  });
  it('rejects self review, uncited findings, and a passed review with blocking findings', () => {
    expect(artifactReviewSchema.safeParse({ ...review, reviewerIdentityId: review.workerIdentityId }).success).toBe(false);
    for (const evidenceDigest of ['e'.repeat(64), 'f'.repeat(64)]) {
      expect(artifactReviewSchema.safeParse({ ...review, findings: [{ severity: 'blocking', summary: 'Test failed', evidenceDigest }] }).success).toBe(false);
    }
    expect(() => assertArtifactAcceptance({ ...input, review: { ...review, verdict: 'changes_required' } }, now)).toThrow();
  });
  it('rejects unknown authority fields and unsupported protocols', () => {
    expect(artifactReviewSchema.safeParse({ ...review, command: 'execute' }).success).toBe(false);
    expect(artifactReviewSchema.safeParse({ ...review, protocolVersion: 2 }).success).toBe(false);
  });
  it('requires bounded, unique evidence and valid review time ordering', () => {
    for (const evidenceDigests of [[], ['e'.repeat(64), 'e'.repeat(64)], Array(21).fill('e'.repeat(64))]) {
      expect(artifactReviewSchema.safeParse({ ...review, evidenceDigests }).success).toBe(false);
    }
    expect(artifactReviewSchema.safeParse({ ...review, expiresAt: review.reviewedAt }).success).toBe(false);
  });
});
