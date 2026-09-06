import 'server-only';
import { Types } from 'mongoose';
import { z } from 'zod';
import { objectIdSchema } from '@nucleas/ai-contracts';
import { AiObjective, AiPlan } from '@/lib/models/AiControl';
import { AiHttpError } from './access';
import type { AiAccess } from './planningQueue';
import type { LibraryKind, LibraryPage, ObjectiveDetail, PlanDetail } from '@/lib/ai/libraryView';

export const LIBRARY_PAGE_SIZE = 25;
export const libraryKindSchema = z.enum(['objectives', 'plans']);
const cursorSchema = z.object({ v: z.literal(1), kind: libraryKindSchema, projectId: objectIdSchema,
  id: objectIdSchema, createdAt: z.string().datetime() }).strict();
type Access = Pick<AiAccess, 'organizationId' | 'project'>;
const scopeFor = (access: Access) => ({ organizationId: access.organizationId, projectId: access.project._id });
export function decodeLibraryCursor(raw: string | null, kind: LibraryKind, projectId: string) {
  if (raw === null) return null;
  try {
    if (raw.length > 512 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error('Invalid cursor.');
    const cursor = cursorSchema.parse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
    if (cursor.kind !== kind || cursor.projectId !== projectId) throw new Error('Wrong collection or project.');
    return cursor;
  } catch { throw new AiHttpError(400, 'Invalid library cursor. Return to the newest items.'); }
}
export async function listLibrary(access: Access, kind: LibraryKind, raw: string | null): Promise<LibraryPage> {
  const projectId = String(access.project._id);
  const cursor = decodeLibraryCursor(raw, kind, projectId);
  const query = { ...scopeFor(access), ...(cursor ? { $or: [{ createdAt: { $lt: new Date(cursor.createdAt) } },
    { createdAt: new Date(cursor.createdAt), _id: { $lt: new Types.ObjectId(cursor.id) } }] } : {}) };
  // Summary pages deliberately omit task arrays and full objective context.
  const records = kind === 'objectives'
    ? (await AiObjective.find(query).select('title createdAt').sort({ createdAt: -1, _id: -1 }).limit(LIBRARY_PAGE_SIZE + 1).lean())
      .map(item => ({ id: String(item._id), title: item.title, createdAt: item.createdAt.toISOString(), status: null, source: null, expiresAt: null }))
    : (await AiPlan.find(query).select('summary status source createdAt expiresAt').sort({ createdAt: -1, _id: -1 }).limit(LIBRARY_PAGE_SIZE + 1).lean())
      .map(item => ({ id: String(item._id), title: item.summary.slice(0, 240), createdAt: item.createdAt.toISOString(),
        status: item.status, source: item.source, expiresAt: item.expiresAt.toISOString() }));
  const items = records.slice(0, LIBRARY_PAGE_SIZE);
  const last = items.at(-1);
  return { kind, items, nextCursor: records.length > LIBRARY_PAGE_SIZE && last ? Buffer.from(JSON.stringify({
    v: 1, kind, projectId, id: last.id, createdAt: last.createdAt,
  })).toString('base64url') : null };
}
export async function getLibraryObjective(access: Access, id: string): Promise<ObjectiveDetail> {
  if (!objectIdSchema.safeParse(id).success) throw new AiHttpError(404, 'Objective not found.');
  const item = await AiObjective.findOne({ ...scopeFor(access), _id: id })
    .select('title outcome constraints acceptanceCriteria createdAt').lean();
  if (!item) throw new AiHttpError(404, 'Objective not found.');
  return { id: String(item._id), title: item.title, outcome: item.outcome, constraints: item.constraints,
    acceptanceCriteria: item.acceptanceCriteria, createdAt: item.createdAt.toISOString() };
}
export async function getLibraryPlan(access: Access, id: string): Promise<PlanDetail> {
  if (!objectIdSchema.safeParse(id).success) throw new AiHttpError(404, 'Plan not found.');
  const item = await AiPlan.findOne({ ...scopeFor(access), _id: id })
    .select('objectiveId runId summary tasks status source digest createdAt expiresAt approvedAt materializedTaskIds projectUpdatedAt').lean();
  if (!item) throw new AiHttpError(404, 'Plan not found.');
  return { id: String(item._id), objectiveId: String(item.objectiveId), runId: item.runId ? String(item.runId) : null,
    summary: item.summary, tasks: item.tasks.map(task => ({ key: task.key, name: task.name, description: task.description,
      acceptanceCriteria: task.acceptanceCriteria, dependsOn: task.dependsOn })),
    status: item.status, source: item.source, digest: item.digest, createdAt: item.createdAt.toISOString(),
    expiresAt: item.expiresAt.toISOString(), approvedAt: item.approvedAt?.toISOString() ?? null,
    materializedTaskIds: item.materializedTaskIds.map(String), expired: item.expiresAt.getTime() <= Date.now(),
    stale: item.projectUpdatedAt.getTime() !== access.project.updatedAt.getTime() };
}
