import { NextRequest } from 'next/server';
import { requireAiProject } from '@/lib/ai/control/access';
import { aiError, aiResponse, readAiBody } from '@/lib/ai/control/http';
import { attemptTeamChatReply } from '@/lib/ai/teamChat';
import { attemptDirectModelChat } from '@/lib/ai/ideDirectChat';
import { employeeForIdeMode, isIdeDirectMode, isIdeWorkerMode } from '@/lib/ide/modes';
import { ideChatSchema } from '@/lib/ide/ideChatSchema';
import { loadIdeTaskRuleTexts } from '@/lib/ide/loadTaskRules';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const access = await requireAiProject(request, (await context.params).id, false, true);
    const input = ideChatSchema.parse(await readAiBody(request));
    const mode = input.mode;
    const ruleTexts = await loadIdeTaskRuleTexts(access.organizationId, access.project._id, mode);

    if (isIdeDirectMode(mode)) {
      const turn = await attemptDirectModelChat({
        projectName: access.project.name,
        organizationId: access.organizationId,
        projectId: access.project._id,
        userId: access.userId,
        userText: input.text,
        priorTurns: input.history,
        modelProfileId: input.modelProfileId!,
        model: input.model!,
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
        employee: null,
        modelProfileId: input.modelProfileId,
        model: input.model,
        rulesApplied: ruleTexts.length,
      });
    }

    if (!isIdeWorkerMode(mode)) {
      throw new Error('Invalid IDE worker mode.');
    }
    const employee = employeeForIdeMode(mode);
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
