import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { requireAiProject, AiHttpError } from '@/lib/ai/control/access';
import { aiError, aiResponse, readAiBody } from '@/lib/ai/control/http';
import { ideTaskRulePatchSchema } from '@/lib/ide/taskRuleSchema';
import { AiProjectTaskRule } from '@/lib/models/AiProjectTaskRule';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string; ruleId: string }> };

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

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { id, ruleId } = await context.params;
    const access = await requireAiProject(request, id, false, true);
    if (!Types.ObjectId.isValid(ruleId)) throw new AiHttpError(404, 'Rule not found.');
    const input = ideTaskRulePatchSchema.parse(await readAiBody(request));
    const row = await AiProjectTaskRule.findOneAndUpdate(
      {
        _id: ruleId,
        organizationId: access.organizationId,
        projectId: access.project._id,
      },
      {
        $set: {
          ...input,
          updatedByUserId: access.userId,
        },
      },
      { new: true, runValidators: true }
    );
    if (!row) throw new AiHttpError(404, 'Rule not found.');
    return aiResponse({ rule: mapRule(row) });
  } catch (error) {
    return aiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { id, ruleId } = await context.params;
    const access = await requireAiProject(request, id, false, true);
    if (!Types.ObjectId.isValid(ruleId)) throw new AiHttpError(404, 'Rule not found.');
    const deleted = await AiProjectTaskRule.findOneAndDelete({
      _id: ruleId,
      organizationId: access.organizationId,
      projectId: access.project._id,
    });
    if (!deleted) throw new AiHttpError(404, 'Rule not found.');
    return aiResponse({ ok: true });
  } catch (error) {
    return aiError(error);
  }
}
