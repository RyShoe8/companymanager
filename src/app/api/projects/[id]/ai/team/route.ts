import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { objectIdSchema } from '@nucleas/ai-contracts';
import { requireAiProject, AiHttpError } from '@/lib/ai/control/access';
import { aiError, aiResponse, readAiBody } from '@/lib/ai/control/http';
import { attemptTeamChatReply, buildTeamContextSummary } from '@/lib/ai/teamChat';
import { normalizeTeamRole, teamHistoryFilter, teamHistorySchema, teamRequestSchema } from '@/lib/ai/teamWorkspace';
import { AiTeamRequest } from '@/lib/models/AiTeamRequest';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
let indexes: Promise<unknown> | undefined;

async function accessFor(request: NextRequest, context: Context) {
  return requireAiProject(request, (await context.params).id, false, true);
}

function scopeFor(access: Awaited<ReturnType<typeof accessFor>>) {
  return { organizationId: access.organizationId, projectId: access.project._id, createdByUserId: access.userId };
}

function mapItem(row: {
  _id: Types.ObjectId;
  employee: string;
  kind: string;
  role?: string;
  text: string;
  cadence: string;
  status: string;
  createdAt: Date;
  failureCategory?: string;
  parentRequestId?: string;
  runId?: string;
}) {
  return {
    id: String(row._id),
    employee: row.employee,
    kind: row.kind,
    role: normalizeTeamRole(row.role),
    text: row.text,
    cadence: row.cadence,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    ...(row.failureCategory ? { failureCategory: row.failureCategory } : {}),
    ...(row.parentRequestId ? { parentRequestId: row.parentRequestId } : {}),
    ...(row.runId ? { runId: row.runId } : {}),
  };
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const access = await accessFor(request, context);
    const query = teamHistorySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const { cursor } = query;
    const rows = await AiTeamRequest.find({
      ...scopeFor(access),
      ...teamHistoryFilter(query),
      ...(cursor ? { _id: { $lt: new Types.ObjectId(cursor) } } : {}),
    })
      .select('employee kind role text cadence status createdAt failureCategory parentRequestId runId')
      .sort({ _id: -1 })
      .limit(26)
      .maxTimeMS(3000)
      .lean();
    const page = rows.slice(0, 25) as unknown as Array<{
      _id: Types.ObjectId;
      employee: string;
      kind: string;
      role?: string;
      text: string;
      cadence: string;
      status: string;
      createdAt: Date;
      failureCategory?: string;
      parentRequestId?: string;
      runId?: string;
    }>;
    const contextSummary = await buildTeamContextSummary(
      access.project.name,
      access.organizationId,
      access.project._id
    );
    return aiResponse({
      project: { id: String(access.project._id), name: access.project.name },
      context: contextSummary,
      items: page.map(mapItem),
      nextCursor: rows.length > 25 ? String(page[24]._id) : null,
    });
  } catch (error) {
    return aiError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const access = await accessFor(request, context);
    const input = teamRequestSchema.parse(await readAiBody(request));
    indexes ??= AiTeamRequest.createIndexes().catch((error) => {
      indexes = undefined;
      throw error;
    });
    await indexes;

    const scope = { ...scopeFor(access), requestId: input.requestId };
    const row = await AiTeamRequest.findOneAndUpdate(
      scope,
      {
        $setOnInsert: {
          ...input,
          ...scope,
          role: 'user',
          status: 'saved',
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    if (
      row.employee !== input.employee ||
      row.kind !== input.kind ||
      row.text !== input.text ||
      row.cadence !== input.cadence ||
      normalizeTeamRole(row.role) !== 'user'
    ) {
      throw new AiHttpError(409, 'This request ID already belongs to different content.');
    }

    let reply: { id: string; role: string; text: string; failureCategory?: string } | null = null;

    if (input.kind === 'message') {
      const existingReply = await AiTeamRequest.findOne({ ...scopeFor(access), parentRequestId: input.requestId })
        .select('_id role text failureCategory').maxTimeMS(3000)
        .lean<{ _id: Types.ObjectId; role: string; text: string; failureCategory?: string } | null>();
      if (existingReply) {
        return aiResponse({ id: String(row._id), status: row.status, reply: {
          id: String(existingReply._id), role: existingReply.role, text: existingReply.text,
          ...(existingReply.failureCategory ? { failureCategory: existingReply.failureCategory } : {}),
        } });
      }
      const claim = await AiTeamRequest.updateOne({ ...scope, _id: row._id, status: 'saved', replyAttemptedAt: { $exists: false } },
        { $set: { replyAttemptedAt: new Date() } });
      if (!claim.modifiedCount) return aiResponse({ id: String(row._id), status: row.status, reply: null, replyPendingOrPreviouslyAttempted: true });
      const prior = await AiTeamRequest.find({
        ...scopeFor(access),
        employee: input.employee,
        kind: 'message',
        status: 'saved',
        role: { $in: ['user', 'assistant'] },
        _id: { $ne: row._id },
      })
        .select('role text')
        .sort({ _id: -1 })
        .limit(8)
        .maxTimeMS(3000)
        .lean();

      const turn = await attemptTeamChatReply({
        employee: input.employee,
        projectName: access.project.name,
        organizationId: access.organizationId,
        projectId: access.project._id,
        userId: access.userId,
        userText: input.text,
        priorTurns: prior
          .reverse()
          .map((item) => ({ role: normalizeTeamRole(item.role), text: item.text })),
      });

      const replyRow = await AiTeamRequest.create({
        ...scopeFor(access),
        requestId: turn.requestId,
        employee: input.employee,
        kind: 'message',
        role: turn.role,
        text: turn.text,
        cadence: 'once',
        status: 'saved',
        parentRequestId: input.requestId,
        ...(turn.failureCategory ? { failureCategory: turn.failureCategory } : {}),
        ...(turn.runId ? { runId: turn.runId } : {}),
      });

      reply = {
        id: String(replyRow._id),
        role: turn.role,
        text: turn.text,
        ...(turn.failureCategory ? { failureCategory: turn.failureCategory } : {}),
      };
    }

    return aiResponse({
      id: String(row._id),
      status: row.status,
      reply,
    });
  } catch (error) {
    return aiError(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const access = await accessFor(request, context);
    const { id } = z.object({ id: objectIdSchema }).strict().parse(await readAiBody(request));
    const result = await AiTeamRequest.updateOne(
      { ...scopeFor(access), _id: id },
      { $set: { status: 'cancelled' } }
    );
    if (!result.matchedCount) throw new AiHttpError(404, 'Request not found.');
    return aiResponse({ status: 'cancelled' });
  } catch (error) {
    return aiError(error);
  }
}
