import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAiProject } from '@/lib/ai/control/access';
import { aiError, aiResponse, readAiBody } from '@/lib/ai/control/http';
import { attemptTeamChatReply } from '@/lib/ai/teamChat';
import { employeeForIdeMode, isIdeChatMode } from '@/lib/ide/modes';
import { loadIdeTaskRuleTexts } from '@/lib/ide/loadTaskRules';
import { teamMessageRoleSchema } from '@/lib/ai/teamWorkspace';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

const ideChatSchema = z
  .object({
    mode: z.string().refine(isIdeChatMode, 'Invalid IDE chat mode.'),
    text: z.string().trim().min(1).max(6000),
    history: z
      .array(
        z
          .object({
            role: teamMessageRoleSchema,
            text: z.string().max(6000),
          })
          .strict()
      )
      .max(20)
      .default([]),
  })
  .strict();

export async function POST(request: NextRequest, context: Context) {
  try {
    const access = await requireAiProject(request, (await context.params).id, false, true);
    const input = ideChatSchema.parse(await readAiBody(request));
    const mode = input.mode;
    const employee = employeeForIdeMode(mode);
    const ruleTexts = await loadIdeTaskRuleTexts(access.organizationId, access.project._id, mode);
    const turn = await attemptTeamChatReply({
      employee,
      projectName: access.project.name,
      organizationId: access.organizationId,
      projectId: access.project._id,
      userId: access.userId,
      userText: input.text,
      priorTurns: input.history,
      ruleTexts,
      signal: request.signal,
    });
    return aiResponse({
      turn: {
        requestId: turn.requestId,
        role: turn.role,
        text: turn.text,
        failureCategory: turn.failureCategory ?? null,
        runId: turn.runId ?? null,
        costMicros: turn.costMicros ?? null,
        reservedMicros: turn.reservedMicros ?? null,
        noProviderFee: turn.noProviderFee ?? false,
      },
      mode,
      employee,
      rulesApplied: ruleTexts.length,
    });
  } catch (error) {
    return aiError(error);
  }
}
