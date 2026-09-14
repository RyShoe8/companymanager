import { NextRequest } from 'next/server';
import { requireAiProject, AiHttpError } from '@/lib/ai/control/access';
import { aiError, aiResponse, readAiBody } from '@/lib/ai/control/http';
import { ideTaskRuleCreateSchema } from '@/lib/ide/taskRuleSchema';
import { AiProjectTaskRule } from '@/lib/models/AiProjectTaskRule';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };
let indexes: Promise<unknown> | undefined;

function mapRule(row: {
  _id: { toString(): string };
  mode: string;
  title: string;
  body: string;
  enabled: boolean;
  sortOrder: number;
  updatedAt?: Date;
  createdAt?: Date;
}) {
  return {
    id: String(row._id),
    mode: row.mode,
    title: row.title,
    body: row.body,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? null,
  };
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const access = await requireAiProject(request, (await context.params).id, false, true);
    const rows = await AiProjectTaskRule.find({
      organizationId: access.organizationId,
      projectId: access.project._id,
    })
      .select('mode title body enabled sortOrder updatedAt createdAt')
      .sort({ sortOrder: 1, _id: 1 })
      .limit(100)
      .maxTimeMS(3000)
      .lean();
    return aiResponse({ rules: rows.map(mapRule), canManage: access.canManage });
  } catch (error) {
    return aiError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const access = await requireAiProject(request, (await context.params).id, false, true);
    const input = ideTaskRuleCreateSchema.parse(await readAiBody(request));
    indexes ??= AiProjectTaskRule.createIndexes().catch((error) => {
      indexes = undefined;
      throw error;
    });
    await indexes;
    const count = await AiProjectTaskRule.countDocuments({
      organizationId: access.organizationId,
      projectId: access.project._id,
    }).maxTimeMS(3000);
    if (count >= 100) throw new AiHttpError(400, 'This project already has the maximum number of task rules.');
    const row = await AiProjectTaskRule.create({
      organizationId: access.organizationId,
      projectId: access.project._id,
      mode: input.mode,
      title: input.title,
      body: input.body,
      enabled: input.enabled,
      sortOrder: input.sortOrder,
      updatedByUserId: access.userId,
    });
    return aiResponse({ rule: mapRule(row) }, 201);
  } catch (error) {
    return aiError(error);
  }
}
