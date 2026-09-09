import 'server-only';
import { Types } from 'mongoose';
import { createHash } from 'node:crypto';
import { objectIdSchema } from '@nucleas/ai-contracts';
import { artifactBindingSchema, artifactReviewSchema } from '../../../../packages/ai-contracts/src/review';
import { AiArtifact, AiArtifactReview, AiArtifactAcceptance } from '@/lib/models/AiArtifactReview';
import { AiHttpError } from './access';
import type { AiAccess } from './planningQueue';

/** Explicitly loaded plain text only. Hash the complete bounded bytes before returning a window. */
export async function getArtifactContent(access: AiAccess, artifactId: string, evidenceDigest: string | null, offset: number) {
  objectIdSchema.parse(artifactId);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1048576 ||
    (evidenceDigest !== null && !/^[a-f0-9]{64}$/.test(evidenceDigest))) throw new AiHttpError(400, 'Invalid content selection.');
  const artifact = await AiArtifact.findOne({ _id: artifactId, organizationId: access.organizationId, projectId: access.project._id })
    .select(evidenceDigest ? 'evidence.digest +evidence.bytes' : 'binding +patch').maxTimeMS(3000);
  if (!artifact) throw new AiHttpError(404, 'Artifact unavailable.');
  const bytes = evidenceDigest ? artifact.evidence.find(item => item.digest === evidenceDigest)?.bytes : artifact.patch;
  if (!bytes) throw new AiHttpError(404, 'Content unavailable.');
  const digest = evidenceDigest ?? artifactBindingSchema.parse(artifact.binding).artifactDigest;
  if (bytes.length > (evidenceDigest ? 65536 : 1048576) || createHash('sha256').update(bytes).digest('hex') !== digest) throw new AiHttpError(409, 'Content integrity check failed.');
  let content: string;
  try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new AiHttpError(415, 'Binary content cannot be displayed as text.'); }
  const end = Math.min(offset + 16384, content.length);
  return { digest, text: content.slice(offset, end), offset, nextOffset: end < content.length ? end : null, totalCharacters: content.length };
}

export async function listArtifacts(access: AiAccess, before: string | null) {
  if (before) objectIdSchema.parse(before);
  const rows = await AiArtifact.find({ organizationId: access.organizationId, projectId: access.project._id,
    ...(before ? { _id: { $lt: new Types.ObjectId(before) } } : {}) })
    .select('runId taskId binding executionVerified createdAt').sort({ _id: -1 }).limit(26).maxTimeMS(3000).lean();
  return { items: rows.slice(0, 25).map(row => ({ artifactId: String(row._id), runId: String(row.runId), taskId: String(row.taskId),
    artifactDigest: artifactBindingSchema.parse(row.binding).artifactDigest, executionVerified: row.executionVerified, createdAt: row.createdAt })),
    nextCursor: rows.length > 25 ? String(rows[24]._id) : null };
}

export async function getArtifactDetail(access: AiAccess, artifactId: string) {
  objectIdSchema.parse(artifactId);
  const scope = { organizationId: access.organizationId, projectId: access.project._id };
  const artifact = await AiArtifact.findOne({ ...scope, _id: artifactId }).select('binding evidence.digest executionVerified createdAt runId taskId').maxTimeMS(3000).lean();
  if (!artifact) throw new AiHttpError(404, 'Artifact unavailable.');
  const review = await AiArtifactReview.findOne({ ...scope, artifactId }).select('payload').sort({ createdAt: -1, _id: -1 }).maxTimeMS(3000).lean();
  const acceptance = await AiArtifactAcceptance.findOne({ ...scope, artifactId }).select('acceptedAt reviewId').maxTimeMS(3000).lean();
  return { artifactId, binding: artifactBindingSchema.parse(artifact.binding), evidenceDigests: artifact.evidence.map(item => item.digest),
    executionVerified: artifact.executionVerified, createdAt: artifact.createdAt, review: review ? artifactReviewSchema.parse(review.payload) : null,
    acceptance: acceptance ? { acceptedAt: acceptance.acceptedAt, reviewId: String(acceptance.reviewId) } : null, canManage: access.canManage };
}
