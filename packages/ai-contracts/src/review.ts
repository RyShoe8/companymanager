import { z } from 'zod';
import { objectIdSchema, PROTOCOL_VERSION } from './index';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
/** Evidence identifiers only: no executable commands, credentials or unbounded logs. */
export const artifactBindingSchema = z.object({
  organizationId: z.string().min(1).max(100), projectId: objectIdSchema, taskId: objectIdSchema,
  runId: objectIdSchema, repositoryCommit: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
  artifactDigest: digest, policyDigest: digest, criteriaDigest: digest,
}).strict();

export const artifactReviewSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION), reviewId: objectIdSchema,
  binding: artifactBindingSchema, workerIdentityId: objectIdSchema, reviewerIdentityId: objectIdSchema,
  verdict: z.enum(['passed', 'changes_required', 'blocked']),
  evidenceDigests: z.array(digest).min(1).max(20),
  findings: z.array(z.object({ severity: z.enum(['info', 'blocking']),
    summary: z.string().trim().min(1).max(1000), evidenceDigest: digest }).strict()).max(50),
  reviewedAt: z.string().datetime(), expiresAt: z.string().datetime(),
}).strict().superRefine((review, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (review.workerIdentityId.toLowerCase() === review.reviewerIdentityId.toLowerCase()) issue('An independent reviewer identity is required.');
  if (new Date(review.expiresAt) <= new Date(review.reviewedAt)) issue('Review expiry must follow review time.');
  if (new Set(review.evidenceDigests).size !== review.evidenceDigests.length) issue('Evidence identifiers must be unique.');
  if (review.findings.some(finding => !review.evidenceDigests.includes(finding.evidenceDigest))) issue('Findings must cite recorded evidence.');
  if (review.verdict === 'passed' && review.findings.some(finding => finding.severity === 'blocking')) issue('Blocking findings cannot pass review.');
});

export const artifactAcceptanceSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION), reviewId: objectIdSchema,
  binding: artifactBindingSchema, acceptedByUserId: objectIdSchema,
  acceptedAt: z.string().datetime(), consumed: z.boolean(),
}).strict();
export type ArtifactBinding = z.infer<typeof artifactBindingSchema>;
