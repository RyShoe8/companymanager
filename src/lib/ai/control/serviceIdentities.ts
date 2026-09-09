import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Types, type ClientSession } from 'mongoose';
import { z } from 'zod';
import { objectIdSchema } from '@nucleas/ai-contracts';
import { assertServiceAction } from '@nucleas/ai-core/serviceIdentity';
import { serviceActionSchema } from '../../../../packages/ai-contracts/src/serviceIdentity';
import { AiServiceIdentity, AiServiceGrant, AiServiceIdentityAudit } from '@/lib/models/AiServiceIdentity';
import { AiRun } from '@/lib/models/AiControl';
import Project from '@/lib/models/Project';
import User from '@/lib/models/User';
import { isPlatformAdmin } from '@/lib/auth/platformAdmin';
import { AiHttpError } from './access';
import { aiTransaction } from './transaction';
import { getPlanningPolicy } from './config';

const revisionSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1);
export const registerServiceIdentitySchema = z.object({ name: z.string().trim().min(1).max(100), role: z.enum(['architect', 'reviewer']) }).strict();
export const changeServiceIdentitySchema = z.object({ identityId: objectIdSchema, revision: revisionSchema,
  action: z.enum(['activate', 'disable', 'revoke', 'rotate']) }).strict();
type Actor = { userId: string; organizationId: string };
const unauthorized = () => new AiHttpError(401, 'Service credential is invalid or inactive.');
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

async function requireCurrentAdmin(actor: Actor, session: ClientSession) {
  const user = await User.findOne({ _id: actor.userId, organizationId: actor.organizationId }).session(session);
  if (!user || !isPlatformAdmin(user)) throw new AiHttpError(403, 'A current platform administrator is required.');
  // Contend with account/role changes rather than trusting only the route's earlier check.
  await User.updateOne({ _id: user._id }, { $inc: { __v: 1 } }, { session });
}

export async function registerServiceIdentity(actor: Actor, raw: unknown) {
  const input = registerServiceIdentitySchema.parse(raw);
  return aiTransaction(async session => {
    await requireCurrentAdmin(actor, session);
    const [identity] = await AiServiceIdentity.create([{ ...input, organizationId: actor.organizationId,
      createdByUserId: actor.userId, status: 'disabled' }], { session });
    await AiServiceIdentityAudit.create([{ organizationId: actor.organizationId, identityId: identity._id,
      actorUserId: actor.userId, action: 'registered', revision: 0 }], { session });
    return { identityId: String(identity._id), status: identity.status, revision: 0 };
  });
}

export async function changeServiceIdentity(actor: Actor, raw: unknown, now = new Date()) {
  const input = changeServiceIdentitySchema.parse(raw);
  if (!Number.isFinite(now.getTime())) throw new AiHttpError(400, 'Invalid timestamp.');
  // Random material is generated once outside a retried transaction; never persisted or audited.
  const secret = input.action === 'rotate' ? randomBytes(32).toString('base64url') : undefined;
  return aiTransaction(async session => {
    await requireCurrentAdmin(actor, session);
    const identity = await AiServiceIdentity.findOne({ _id: input.identityId, organizationId: actor.organizationId,
      revision: input.revision }).session(session);
    if (!identity) throw new AiHttpError(409, 'Identity changed or is unavailable. Reload before editing.');
    if (identity.status === 'revoked') throw new AiHttpError(409, 'Revoked identities cannot be reactivated.');
    let credential: string | undefined;
    if (input.action === 'rotate') {
      if (identity.credentialVersion >= Number.MAX_SAFE_INTEGER - 1) throw new AiHttpError(409, 'Credential version exhausted.');
      identity.credentialVersion += 1;
      credential = `nas1.${identity._id}.${identity.credentialVersion}.${secret}`;
      identity.credentialHash = hash(credential);
      identity.credentialExpiresAt = new Date(now.getTime() + 30 * 86400000);
    } else if (input.action === 'activate') {
      if (!identity.credentialExpiresAt || identity.credentialExpiresAt <= now) throw new AiHttpError(409, 'Issue a current credential before activating.');
      identity.status = 'active';
    } else {
      identity.status = input.action === 'disable' ? 'disabled' : 'revoked';
      // A later reactivation must not revive previously issued grants.
      identity.grantEpoch += 1;
    }
    identity.revision += 1;
    await identity.save({ session });
    const action = ({ activate: 'activated', disable: 'disabled', revoke: 'revoked', rotate: 'rotated' } as const)[input.action];
    await AiServiceIdentityAudit.create([{ organizationId: actor.organizationId, identityId: identity._id,
      actorUserId: actor.userId, action, revision: identity.revision }], { session });
    return { identityId: String(identity._id), revision: identity.revision, status: identity.status,
      credentialVersion: identity.credentialVersion, credentialExpiresAt: identity.credentialExpiresAt, ...(credential ? { credential } : {}) };
  });
}

/** Authentication only. Call authorizeStoredServiceAction in the same transaction as a protected mutation. */
export async function authenticateServiceCredential(authorization: string | null, session?: ClientSession, now = new Date()) {
  const match = authorization?.match(/^Bearer (nas1\.([a-f0-9]{24})\.([1-9]\d{0,15})\.([A-Za-z0-9_-]{43}))$/);
  if (!match || !Number.isFinite(now.getTime())) throw unauthorized();
  const identity = await AiServiceIdentity.findOne({ _id: match[2], status: 'active', credentialVersion: Number(match[3]),
    credentialExpiresAt: { $gt: now } }).select('+credentialHash').session(session ?? null).lean();
  const actual = Buffer.from(hash(match[1]), 'hex');
  const expected = Buffer.from(identity?.credentialHash ?? '0'.repeat(64), 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual) || !identity) throw unauthorized();
  return { kind: 'service' as const, identityId: String(identity._id), credentialVersion: identity.credentialVersion };
}

export async function issueServiceGrant(actor: Actor, raw: unknown, now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw new AiHttpError(400, 'Invalid timestamp.');
  const input = z.object({ identityId: objectIdSchema, runId: objectIdSchema, expiresInSeconds: z.number().int().min(1).max(900) }).strict().parse(raw);
  return aiTransaction(async session => {
    await requireCurrentAdmin(actor, session);
    const identity = await AiServiceIdentity.findOne({ _id: input.identityId, organizationId: actor.organizationId,
      status: 'active', credentialExpiresAt: { $gt: now } }).session(session);
    const run = await AiRun.findOne({ _id: input.runId, organizationId: actor.organizationId }).session(session);
    if (!identity || !run) throw new AiHttpError(404, 'Identity or run unavailable.');
    const operation = identity.role === 'architect' ? 'planning.infer' : 'artifact.review';
    const validRun = operation === 'planning.infer' ? run.role === 'architect' && ['queued', 'running'].includes(run.status)
      : run.role === 'worker' && ['review_required', 'reviewing'].includes(run.status);
    if (!validRun) throw new AiHttpError(409, 'Run is not eligible for this operation.');
    const project = await Project.findById(run.projectId).session(session);
    if (!project || !await User.exists({ _id: project.userId, organizationId: actor.organizationId }).session(session)) throw new AiHttpError(404, 'Project unavailable.');
    await AiServiceIdentity.updateOne({ _id: identity._id }, { $inc: { authorityFence: 1 } }, { session });
    const [grant] = await AiServiceGrant.create([{ organizationId: actor.organizationId, identityId: identity._id,
      projectId: run.projectId, runId: run._id, operation, policyDigest: run.policyDigest, credentialVersion: identity.credentialVersion, grantEpoch: identity.grantEpoch,
      issuedAt: now, expiresAt: new Date(Math.min(now.getTime() + input.expiresInSeconds * 1000, identity.credentialExpiresAt!.getTime())),
      createdByUserId: actor.userId }], { session });
    await AiServiceIdentityAudit.create([{ organizationId: actor.organizationId, identityId: identity._id, grantId: grant._id,
      actorUserId: actor.userId, action: 'grant-issued', revision: 0 }], { session });
    return { grantId: String(grant._id), revision: 0, expiresAt: grant.expiresAt, operation };
  });
}

/** Server-only primitive, not a service endpoint or permission to run tools. */
export async function authorizeStoredServiceAction(authorization: string | null, grantId: string, rawAction: unknown, session: ClientSession, now = new Date(), recordedReviewId?: string) {
  objectIdSchema.parse(grantId);
  const action = serviceActionSchema.parse(rawAction);
  const principal = await authenticateServiceCredential(authorization, session, now);
  const identity = await AiServiceIdentity.findOne({ _id: principal.identityId, organizationId: action.organizationId }).session(session);
  const grant = await AiServiceGrant.findOne({ _id: grantId, organizationId: action.organizationId, identityId: principal.identityId }).session(session);
  if (!identity || !grant || grant.credentialVersion !== principal.credentialVersion || grant.grantEpoch !== identity.grantEpoch) throw unauthorized();
  await requireCurrentAdmin({ userId: String(grant.createdByUserId), organizationId: grant.organizationId }, session);
  const run = await AiRun.findOne({ _id: grant.runId, organizationId: grant.organizationId, projectId: grant.projectId,
    policyDigest: grant.policyDigest }).session(session);
  const eligible = run && (grant.operation === 'planning.infer'
    ? run.role === 'architect' && ['queued', 'running'].includes(run.status)
    : run.role === 'worker' && (recordedReviewId
      ? String(run.currentReviewId) === recordedReviewId && ['awaiting_acceptance', 'revision_required', 'completed'].includes(run.status)
      : ['review_required', 'reviewing'].includes(run.status)));
  if (!eligible) throw new AiHttpError(403, 'Run no longer permits this action.');
  const project = await Project.findById(grant.projectId).session(session);
  if (!project || !await User.exists({ _id: project.userId, organizationId: grant.organizationId }).session(session)) throw unauthorized();
  // Until a separate coding policy exists, service authority is gated by the current planning policy.
  const policy = await getPlanningPolicy(grant.organizationId, String(grant.projectId), session);
  if (policy.digest !== grant.policyDigest) throw new AiHttpError(403, 'Policy changed.');
  await AiRun.updateOne({ _id: run!._id }, { $inc: { __v: 1 } }, { session });
  let result: ReturnType<typeof assertServiceAction>;
  try { result = assertServiceAction({ principal, identity: { protocolVersion: 1, identityId: String(identity._id),
    organizationId: identity.organizationId, role: identity.role, status: identity.status, credentialVersion: identity.credentialVersion },
    grant: { protocolVersion: 1, grantId: String(grant._id), identityId: String(grant.identityId), organizationId: grant.organizationId,
      projectId: String(grant.projectId), runId: String(grant.runId), operation: grant.operation, policyDigest: grant.policyDigest,
      revision: grant.revision, issuedAt: grant.issuedAt.toISOString(), expiresAt: grant.expiresAt.toISOString(), revoked: grant.revoked }, action }, now);
  } catch { throw new AiHttpError(403, 'Service action is not authorized by the current identity and scoped grant.'); }
  await AiServiceIdentity.updateOne({ _id: identity._id }, { $inc: { authorityFence: 1 } }, { session });
  await AiServiceGrant.updateOne({ _id: grant._id }, { $inc: { authorityFence: 1 } }, { session });
  return result;
}

export async function revokeServiceGrant(actor: Actor, raw: unknown) {
  const input = z.object({ grantId: objectIdSchema, revision: revisionSchema }).strict().parse(raw);
  return aiTransaction(async session => {
    await requireCurrentAdmin(actor, session);
    const grant = await AiServiceGrant.findOneAndUpdate({ _id: input.grantId, organizationId: actor.organizationId,
      revision: input.revision, revoked: false }, { $set: { revoked: true }, $inc: { revision: 1 } }, { new: true, session });
    if (!grant) throw new AiHttpError(409, 'Grant changed or is unavailable.');
    await AiServiceIdentityAudit.create([{ organizationId: actor.organizationId, identityId: grant.identityId, grantId: grant._id,
      actorUserId: actor.userId, action: 'grant-revoked', revision: grant.revision }], { session });
    return { grantId: String(grant._id), revision: grant.revision, revoked: true };
  });
}

export async function listServiceIdentities(organizationId: string, before: string | null) {
  if (before) objectIdSchema.parse(before);
  const rows = await AiServiceIdentity.find({ organizationId, ...(before ? { _id: { $lt: new Types.ObjectId(before) } } : {}) })
    .select('name role status revision credentialVersion credentialExpiresAt').sort({ _id: -1 }).limit(26).maxTimeMS(3000).lean();
  return { items: rows.slice(0, 25).map(row => ({ identityId: String(row._id), name: row.name, role: row.role,
    status: row.status, revision: row.revision, credentialVersion: row.credentialVersion, credentialExpiresAt: row.credentialExpiresAt ?? null })),
    nextCursor: rows.length > 25 ? String(rows[24]._id) : null };
}

export async function listServiceGrants(organizationId: string, identityId: string, before: string | null) {
  objectIdSchema.parse(identityId);
  if (before) objectIdSchema.parse(before);
  const rows = await AiServiceGrant.find({ organizationId, identityId,
    ...(before ? { _id: { $lt: new Types.ObjectId(before) } } : {}) })
    .select('projectId runId operation revision revoked expiresAt credentialVersion grantEpoch')
    .sort({ _id: -1 }).limit(26).maxTimeMS(3000).lean();
  return { items: rows.slice(0, 25).map(row => ({ grantId: String(row._id), projectId: String(row.projectId),
    runId: String(row.runId), operation: row.operation, revision: row.revision, revoked: row.revoked,
    expiresAt: row.expiresAt, credentialVersion: row.credentialVersion, grantEpoch: row.grantEpoch })),
    nextCursor: rows.length > 25 ? String(rows[24]._id) : null };
}
