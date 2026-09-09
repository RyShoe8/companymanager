import 'server-only';
import { createHash } from 'node:crypto';
import { Types } from 'mongoose';
import { z } from 'zod';
import { objectIdSchema } from '@nucleas/ai-contracts';
import { digestValue } from '@nucleas/ai-core/planning';
import { assertArtifactAcceptance } from '@nucleas/ai-core/review';
import { artifactBindingSchema, artifactReviewSchema } from '../../../../packages/ai-contracts/src/review';
import { AiArtifact, AiArtifactReview, AiArtifactAcceptance } from '@/lib/models/AiArtifactReview';
import { AiRun, AiRunEvent } from '@/lib/models/AiControl';
import { AiServiceIdentity, AiServiceGrant } from '@/lib/models/AiServiceIdentity';
import Project from '@/lib/models/Project';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import { isPlatformAdmin } from '@/lib/auth/platformAdmin';
import { AiHttpError } from './access';
import type { AiAccess } from './planningQueue';
import { aiTransaction } from './transaction';
import { authorizeStoredServiceAction } from './serviceIdentities';
import { getPlanningPolicy } from './config';

const byteDigest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const artifactInput = z.object({ organizationId: z.string().min(1).max(100), projectId: objectIdSchema,
  taskId: objectIdSchema, runId: objectIdSchema, workerIdentityId: objectIdSchema,
  repositoryCommit: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/), expectedRunRevision: z.number().int().nonnegative() }).strict();

/** Internal runtime storage, deliberately not exposed as an upload endpoint. Bytes are unverified
 * until a separately authorized sandbox attestation integration exists; this function cannot mark them verified. */
export async function storeUnverifiedArtifact(raw: unknown, patch: Uint8Array, evidence: Uint8Array[]) {
  const input = artifactInput.parse(raw);
  if (patch.byteLength === 0 || patch.byteLength > 1024 * 1024 || evidence.length === 0 || evidence.length > 20 ||
    evidence.some(bytes => bytes.byteLength === 0 || bytes.byteLength > 65536)) throw new AiHttpError(400, 'Artifact or evidence exceeds storage limits.');
  const patchBytes = Buffer.from(patch);
  const records = evidence.map(bytes => ({ bytes: Buffer.from(bytes), digest: byteDigest(bytes) }));
  if (new Set(records.map(item => item.digest)).size !== records.length) throw new AiHttpError(400, 'Duplicate evidence.');
  return aiTransaction(async session => {
    const scope = { organizationId: input.organizationId, projectId: input.projectId, runId: input.runId, taskId: input.taskId };
    const run = await AiRun.findOne({ _id: input.runId, organizationId: input.organizationId, projectId: input.projectId,
      taskId: input.taskId, role: 'worker', status: 'review_required', revision: input.expectedRunRevision }).session(session);
    const project = await Project.findById(input.projectId).session(session);
    const task = project?.tasks?.find(item => String(item._id) === input.taskId);
    if (!run || !project || !task || !await User.exists({ _id: project.userId, organizationId: input.organizationId }).session(session)) throw new AiHttpError(409, 'Current task/run is unavailable.');
    const binding = artifactBindingSchema.parse({ ...scope, repositoryCommit: input.repositoryCommit,
      artifactDigest: byteDigest(patchBytes), criteriaDigest: digestValue(task.acceptanceCriteria ?? []), policyDigest: run.policyDigest });
    const bindingDigest = digestValue(binding);
    const [artifact] = await AiArtifact.create([{ ...scope, binding, bindingDigest, workerIdentityId: input.workerIdentityId,
      patch: patchBytes, evidence: records, projectUpdatedAt: project.updatedAt, executionVerified: false }], { session });
    run.currentArtifactId = artifact._id; run.currentReviewId = undefined; run.revision += 1;
    await run.save({ session });
    await AiRunEvent.create([{ organizationId: input.organizationId, projectId: input.projectId, runId: run._id,
      sequence: run.revision, type: 'artifact.recorded', summary: 'Artifact bytes recorded. Execution evidence is unverified; task completion is blocked.' }], { session });
    return { artifactId: String(artifact._id), binding, evidenceDigests: records.map(item => item.digest), executionVerified: false };
  });
}

export async function recordArtifactReview(authorization: string | null, grantId: string, grantRevision: number, artifactId: string, rawReview: unknown, now = new Date()) {
  objectIdSchema.parse(artifactId);
  const review = artifactReviewSchema.parse(rawReview);
  if (!Number.isFinite(now.getTime()) || new Date(review.reviewedAt) > now || new Date(review.expiresAt) <= now ||
    new Date(review.expiresAt).getTime() > now.getTime() + 86400000) throw new AiHttpError(400, 'Invalid review validity window.');
  return aiTransaction(async session => {
    const artifact = await AiArtifact.findOne({ _id: artifactId, organizationId: review.binding.organizationId,
      projectId: review.binding.projectId, runId: review.binding.runId, taskId: review.binding.taskId }).session(session);
    if (!artifact || digestValue(review.binding) !== artifact.bindingDigest || review.workerIdentityId !== String(artifact.workerIdentityId) ||
      review.evidenceDigests.some(digest => !artifact.evidence.some(item => item.digest === digest))) throw new AiHttpError(409, 'Review does not match stored artifact and evidence.');
    const existing = await AiArtifactReview.findById(review.reviewId).session(session);
    if (existing && (existing.payloadDigest !== digestValue(review) || String(existing.artifactId) !== artifactId ||
      String(existing.grantId) !== grantId || existing.grantRevision !== grantRevision)) throw new AiHttpError(409, 'Review ID already belongs to a different submission.');
    const authority = await authorizeStoredServiceAction(authorization, grantId, { organizationId: artifact.organizationId,
      projectId: String(artifact.projectId), runId: String(artifact.runId), operation: 'artifact.review',
      policyDigest: review.binding.policyDigest, grantRevision }, session, now, existing ? review.reviewId : undefined);
    if (authority.identityId !== review.reviewerIdentityId) throw new AiHttpError(403, 'Reviewer identity mismatch.');
    const identity = await AiServiceIdentity.findById(authority.identityId).session(session).orFail();
    if (existing) {
      if (existing.credentialVersion !== identity.credentialVersion || existing.grantEpoch !== identity.grantEpoch) throw new AiHttpError(403, 'Review authority changed.');
      const currentRun = await AiRun.findById(artifact.runId).session(session).orFail();
      return { reviewId: review.reviewId, status: currentRun.status, alreadyRecorded: true };
    }
    const run = await AiRun.findOne({ _id: artifact.runId, organizationId: artifact.organizationId, currentArtifactId: artifact._id,
      status: { $in: ['review_required', 'reviewing'] } }).session(session);
    if (!run) throw new AiHttpError(409, 'Artifact is no longer current.');
    await AiArtifactReview.create([{ _id: review.reviewId, organizationId: artifact.organizationId, projectId: artifact.projectId,
      taskId: artifact.taskId, runId: artifact.runId, artifactId: artifact._id, payload: review, payloadDigest: digestValue(review),
      reviewerIdentityId: identity._id, credentialVersion: identity.credentialVersion, grantEpoch: identity.grantEpoch, grantId, grantRevision }], { session });
    run.currentReviewId = new Types.ObjectId(review.reviewId);
    run.status = review.verdict === 'passed' ? 'awaiting_acceptance' : 'revision_required';
    run.revision += 1;
    await run.save({ session });
    await AiRunEvent.create([{ organizationId: artifact.organizationId, projectId: artifact.projectId, runId: run._id,
      sequence: run.revision, type: 'artifact.reviewed', summary: review.verdict === 'passed'
        ? 'Reviewer recorded a passed review; verified execution and human acceptance are still required.' : 'Reviewer requires revision; task remains unchanged.' }], { session });
    return { reviewId: review.reviewId, status: run.status };
  });
}

/** Human acceptance stays fail-closed until trusted sandbox evidence verification is integrated. */
export async function acceptStoredArtifact(access: AiAccess, reviewId: string, now = new Date()) {
  objectIdSchema.parse(reviewId);
  if (!access.canManage || !Number.isFinite(now.getTime())) throw new AiHttpError(403, 'Current manager approval is required.');
  return aiTransaction(async session => {
    const member = await User.findOne({ _id: access.userId, organizationId: access.organizationId }).session(session);
    const approver = await Employee.findOne({ userId: access.userId, organizationId: access.organizationId,
      role: { $in: ['Manager', 'Administrator'] } }).session(session);
    if (!member || !approver) throw new AiHttpError(403, 'Approval authority is no longer available.');
    await User.updateOne({ _id: member._id }, { $inc: { __v: 1 } }, { session });
    await Employee.updateOne({ _id: approver._id }, { $inc: { __v: 1 } }, { session });
    const review = await AiArtifactReview.findOne({ _id: reviewId, organizationId: access.organizationId, projectId: access.project._id }).session(session);
    if (!review) throw new AiHttpError(404, 'Review unavailable.');
    const prior = await AiArtifactAcceptance.findOne({ organizationId: access.organizationId, runId: review.runId }).session(session);
    if (prior) {
      if (String(prior.reviewId) !== reviewId) throw new AiHttpError(409, 'A different result has already been accepted.');
      return { acceptanceId: String(prior._id), alreadyAccepted: true };
    }
    const artifact = await AiArtifact.findById(review.artifactId).select('+patch +evidence.bytes').session(session);
    const reviewer = await AiServiceIdentity.findOne({ _id: review.reviewerIdentityId, organizationId: access.organizationId,
      role: 'reviewer', status: 'active', credentialVersion: review.credentialVersion, grantEpoch: review.grantEpoch,
      credentialExpiresAt: { $gt: now } }).session(session);
    if (!artifact?.executionVerified) throw new AiHttpError(409, 'Sandbox execution evidence has not been verified.');
    if (!reviewer || digestValue(review.payload) !== review.payloadDigest) throw new AiHttpError(409, 'Review authority or integrity changed.');
    const grant = await AiServiceGrant.findOne({ _id: review.grantId, organizationId: access.organizationId, projectId: review.projectId,
      runId: review.runId, identityId: reviewer._id, operation: 'artifact.review', revision: review.grantRevision,
      revoked: false, grantEpoch: reviewer.grantEpoch, credentialVersion: reviewer.credentialVersion, expiresAt: { $gt: now } }).session(session);
    if (!grant) throw new AiHttpError(409, 'Reviewer grant is no longer current.');
    const issuer = await User.findOne({ _id: grant.createdByUserId, organizationId: access.organizationId }).session(session);
    if (!issuer || !isPlatformAdmin(issuer)) throw new AiHttpError(409, 'Reviewer grant issuer is no longer authorized.');
    await User.updateOne({ _id: issuer._id }, { $inc: { __v: 1 } }, { session });
    const project = await Project.findOne({ _id: review.projectId, userId: { $in: access.ownerIds } }).session(session);
    const task = project?.tasks?.find(item => String(item._id) === String(review.taskId));
    if (!project || !task || !await User.exists({ _id: project.userId, organizationId: access.organizationId }).session(session)) throw new AiHttpError(404, 'Task unavailable.');
    await User.updateOne({ _id: project.userId }, { $inc: { __v: 1 } }, { session });
    const binding = artifactBindingSchema.parse(artifact.binding);
    if (!artifact.patch || byteDigest(artifact.patch) !== binding.artifactDigest ||
      artifact.evidence.some(item => !item.bytes || byteDigest(item.bytes) !== item.digest)) throw new AiHttpError(409, 'Stored artifact bytes failed integrity checks.');
    if (digestValue(binding) !== artifact.bindingDigest || digestValue(task.acceptanceCriteria ?? []) !== binding.criteriaDigest ||
      project.updatedAt?.getTime() !== artifact.projectUpdatedAt.getTime()) throw new AiHttpError(409, 'Task or artifact changed since review.');
    const policy = await getPlanningPolicy(access.organizationId, String(project._id), session);
    if (policy.digest !== binding.policyDigest) throw new AiHttpError(409, 'Policy changed since review.');
    try { assertArtifactAcceptance({ currentBinding: binding, review: review.payload,
      acceptance: { protocolVersion: 1, reviewId, binding, acceptedByUserId: access.userId, acceptedAt: now.toISOString(), consumed: false },
      authorizedHumanUserId: access.userId, authorizedReviewerIdentityId: String(reviewer._id), workerIdentityId: String(artifact.workerIdentityId) }, now);
    } catch { throw new AiHttpError(409, 'Review is expired, unsuccessful, or no longer matches this artifact.'); }
    await AiServiceIdentity.updateOne({ _id: reviewer._id }, { $inc: { authorityFence: 1 } }, { session });
    await AiServiceGrant.updateOne({ _id: grant._id }, { $inc: { authorityFence: 1 } }, { session });
    const run = await AiRun.findOneAndUpdate({ _id: review.runId, organizationId: access.organizationId, projectId: project._id,
      taskId: review.taskId, role: 'worker', status: 'awaiting_acceptance', currentReviewId: review._id, currentArtifactId: artifact._id,
      policyDigest: binding.policyDigest }, { $set: { status: 'completed', completedAt: now }, $inc: { revision: 1 } }, { new: true, session });
    if (!run) throw new AiHttpError(409, 'Run or current review changed.');
    const updated = await Project.updateOne({ _id: project._id, updatedAt: artifact.projectUpdatedAt, 'tasks._id': review.taskId },
      { $set: { 'tasks.$.status': 'completed', 'tasks.$.completedAt': now }, $inc: { __v: 1 } }, { session, runValidators: true });
    if (updated.modifiedCount !== 1) throw new AiHttpError(409, 'Task changed during acceptance.');
    const [acceptance] = await AiArtifactAcceptance.create([{ organizationId: access.organizationId, projectId: project._id,
      taskId: review.taskId, runId: review.runId, artifactId: artifact._id, reviewId: review._id, bindingDigest: artifact.bindingDigest,
      acceptedByUserId: access.userId, acceptedAt: now, consumed: true }], { session });
    await AiRunEvent.create([{ organizationId: access.organizationId, projectId: project._id, runId: run._id,
      sequence: run.revision, type: 'artifact.accepted', summary: 'Human accepted the exact reviewed artifact with verified execution evidence.' }], { session });
    return { acceptanceId: String(acceptance._id), alreadyAccepted: false };
  });
}
