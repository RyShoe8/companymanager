import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { objectIdSchema } from '@nucleas/ai-contracts';
import { requireAuth } from '@/lib/auth/middleware';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import Project from '@/lib/models/Project';
import { AiRun, AiRunAcknowledgement } from '@/lib/models/AiControl';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import { canUserContributeToProject } from '@/lib/utils/projectTeam';
import { isManagerOrAdminRole } from '@/lib/utils/roles';
import { AiHttpError } from './access';
import type { AiAccess } from './planningQueue';
import type { AttentionPage, AttentionFilter } from '@/lib/ai/attentionView';

export const attentionFilterSchema = z.enum(['all', 'review', 'issues']);
const reviewStates = ['awaiting_acceptance', 'waiting_for_approval', 'revision_required'];
const issueStates = ['blocked', 'failed'];
const PAGE_SIZE = 25, BATCH_SIZE = 50, MAX_BATCHES = 3;
type AttentionAccess = { userId: string; organizationId: string; employeeId: string | null; canManage: boolean; ownerIds: Types.ObjectId[] };
export async function requireAttentionAccess(request: NextRequest): Promise<AttentionAccess> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) throw new AiHttpError(401, 'Sign in to continue.');
  await connectDB();
  const user = await User.findById(auth.userId).select('organizationId').lean();
  if (!user?.organizationId) throw new AiHttpError(403, 'Organization membership required.');
  const employee = await Employee.findOne({ userId: auth.userId, organizationId: user.organizationId }).select('role').lean();
  return { userId: auth.userId, organizationId: user.organizationId, employeeId: employee ? String(employee._id) : null,
    canManage: isManagerOrAdminRole(employee?.role), ownerIds: await getOrganizationUserIds(auth.userId, user.organizationId) };
}
const cursorSchema = z.object({ userId: objectIdSchema, organizationId: z.string().min(1).max(200), filter: attentionFilterSchema,
  id: objectIdSchema, createdAt: z.string().datetime(), expiresAt: z.number().int() }).strict();
function cursorKey() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('Session secret unavailable.');
  return createHash('sha256').update(`nucleas-ai-attention-cursor-v1:${secret}`).digest();
}
// Scans can pass inaccessible projects. Encrypt cursors so they never expose those run IDs.
export function encodeAttentionCursor(value: z.infer<typeof cursorSchema>) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', cursorKey(), iv);
  const payload = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), payload]).toString('base64url');
}
export function decodeAttentionCursor(raw: string | null, access: Pick<AttentionAccess, 'userId' | 'organizationId'>, filter: AttentionFilter) {
  if (raw === null) return null;
  try {
    if (raw.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error('Invalid cursor.');
    const bytes = Buffer.from(raw, 'base64url');
    const cipher = createDecipheriv('aes-256-gcm', cursorKey(), bytes.subarray(0, 12)); cipher.setAuthTag(bytes.subarray(12, 28));
    const value = cursorSchema.parse(JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8')));
    if (value.userId !== access.userId || value.organizationId !== access.organizationId || value.filter !== filter || value.expiresAt <= Date.now()) throw new Error('Stale or mismatched cursor.');
    return value;
  } catch { throw new AiHttpError(400, 'Attention history changed or the cursor expired. Return to the newest items.'); }
}
export async function listAttention(access: AttentionAccess, filter: AttentionFilter, rawCursor: string | null): Promise<AttentionPage> {
  let cursor = decodeAttentionCursor(rawCursor, access, filter);
  const items: AttentionPage['items'] = [];
  if (!access.canManage && !access.employeeId) return { items, nextCursor: null, canManage: false };
  const states = filter === 'review' ? reviewStates : filter === 'issues' ? issueStates : [...reviewStates, ...issueStates];
  let more = false;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const rows = await AiRun.find({ organizationId: access.organizationId, status: { $in: states }, ...(cursor ? { $or: [
      { createdAt: { $lt: new Date(cursor.createdAt) } }, { createdAt: new Date(cursor.createdAt), _id: { $lt: new Types.ObjectId(cursor.id) } },
    ] } : {}) }).select('projectId role status revision createdAt failureCode planId').sort({ createdAt: -1, _id: -1 }).limit(BATCH_SIZE).lean();
    if (!rows.length) { more = false; break; }
    const [projects, acknowledgements] = await Promise.all([
      Project.find({ _id: { $in: rows.map(row => row.projectId) }, userId: { $in: access.ownerIds } })
        .select('name assignedToEmployeeIds assignedToEmployeeId tasks.assignedToEmployeeIds tasks.assignedToEmployeeId').lean(),
      AiRunAcknowledgement.find({ organizationId: access.organizationId, userId: access.userId, runId: { $in: rows.map(row => row._id) } })
        .select('runId revision').limit(BATCH_SIZE).lean(),
    ]);
    const visible = new Map(projects.filter(project => canUserContributeToProject(project, access.employeeId, access.canManage)).map(project => [String(project._id), project.name]));
    const acknowledged = new Map(acknowledgements.map(item => [String(item.runId), item.revision]));
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      cursor = { userId: access.userId, organizationId: access.organizationId, filter, id: String(row._id),
        createdAt: row.createdAt.toISOString(), expiresAt: Date.now() + 3600000 };
      const name = visible.get(String(row.projectId));
      if (name !== undefined && acknowledged.get(String(row._id)) !== row.revision) items.push({
        id: String(row._id), projectId: String(row.projectId), projectName: name, role: row.role, status: row.status,
        revision: row.revision, createdAt: row.createdAt.toISOString(), failureCode: row.failureCode ?? null, planId: row.planId ? String(row.planId) : null,
      });
      more = index < rows.length - 1 || rows.length === BATCH_SIZE;
      if (items.length === PAGE_SIZE) break;
    }
    if (items.length === PAGE_SIZE || !more) break;
  }
  return { items, nextCursor: more && cursor ? encodeAttentionCursor(cursor) : null, canManage: access.canManage };
}
export async function acknowledgeRun(access: AiAccess, runId: string, revision: number) {
  const run = await AiRun.findOne({ _id: runId, organizationId: access.organizationId, projectId: access.project._id }).select('revision').lean();
  if (!run) throw new AiHttpError(404, 'Run not found.');
  if (run.revision !== revision) throw new AiHttpError(409, 'Run changed. Refresh and review its current state.');
  await AiRunAcknowledgement.updateOne({ organizationId: access.organizationId, userId: access.userId, runId: run._id },
    { $max: { revision } }, { upsert: true, runValidators: true });
  // A subsequent run revision becomes visible again, including one racing this write.
  return { acknowledged: true };
}
