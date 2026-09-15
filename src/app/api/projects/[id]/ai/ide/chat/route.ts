import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { AiHttpError, requireAiProject } from '@/lib/ai/control/access';
import { aiError, aiResponse, readAiBody } from '@/lib/ai/control/http';
import { attemptTeamChatReply } from '@/lib/ai/teamChat';
import { attemptDirectModelChat } from '@/lib/ai/ideDirectChat';
import {
  employeeForIdeMode,
  isIdeChatMode,
  isIdeDirectMode,
  isIdeWorkerMode,
  normalizeIdeChatMode,
} from '@/lib/ide/modes';
import { ideChatSchema } from '@/lib/ide/ideChatSchema';
import { loadIdeTaskRuleTexts } from '@/lib/ide/loadTaskRules';
import { appendIdeChatTurns, loadIdeChatHistory } from '@/lib/ide/chatHistory';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const access = await requireAiProject(request, (await context.params).id, false, true);
    const modeRaw = request.nextUrl.searchParams.get('mode')?.trim() ?? '';
    const mode = normalizeIdeChatMode(modeRaw);
    if (!mode || !isIdeChatMode(mode)) {
      throw new AiHttpError(400, 'Invalid IDE chat mode.');
    }
    const modelProfileId = request.nextUrl.searchParams.get('modelProfileId')?.trim() ?? '';
    const model = request.nextUrl.searchParams.get('model')?.trim() ?? '';
    const turns = await loadIdeChatHistory({
      organizationId: access.organizationId,
      projectId: access.project._id,
      userId: access.userId,
      mode,
      modelProfileId: isIdeDirectMode(mode) ? modelProfileId : undefined,
      model: isIdeDirectMode(mode) ? model : undefined,
    });
    return aiResponse({ mode, turns });
  } catch (error) {
    return aiError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const access = await requireAiProject(request, (await context.params).id, false, true);
    const input = ideChatSchema.parse(await readAiBody(request));
    const mode = input.mode;
    const ruleTexts = await loadIdeTaskRuleTexts(access.organizationId, access.project._id, mode);
    const userRequestId = randomUUID();

    const persistPair = async (reply: {
      requestId: string;
      role: 'user' | 'assistant' | 'status';
      text: string;
      failureCategory?: string;
      runId?: string;
      costMicros?: number | null;
      reservedMicros?: number | null;
      noProviderFee?: boolean;
      toolsUsed?: string[];
      artifacts?: { kind: 'image'; assetId: string; name: string; url: string }[];
    }) => {
      await appendIdeChatTurns({
        organizationId: access.organizationId,
        projectId: access.project._id,
        userId: access.userId,
        mode,
        modelProfileId: input.modelProfileId,
        model: input.model,
        turns: [
          {
            requestId: userRequestId,
            role: 'user',
            text: input.text,
          },
          {
            requestId: reply.requestId,
            role: reply.role,
            text: reply.text,
            failureCategory: reply.failureCategory ?? null,
            runId: reply.runId ?? null,
            costMicros: reply.costMicros ?? null,
            reservedMicros: reply.reservedMicros ?? null,
            noProviderFee: reply.noProviderFee ?? false,
            toolsUsed: reply.toolsUsed ?? [],
            artifacts: reply.artifacts ?? [],
          },
        ],
      });
    };

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
      await persistPair(turn);
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
          artifacts: turn.artifacts ?? [],
          toolsUsed: turn.toolsUsed ?? [],
        },
        mode,
        employee: null,
        modelProfileId: input.modelProfileId,
        model: input.model,
        rulesApplied: ruleTexts.length,
      });
    }

    if (!isIdeWorkerMode(mode)) {
      throw new AiHttpError(400, 'Invalid IDE worker mode.');
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
    await persistPair(turn);
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
        artifacts: turn.artifacts ?? [],
        toolsUsed: turn.toolsUsed ?? [],
      },
      mode,
      employee,
      rulesApplied: ruleTexts.length,
    });
  } catch (error) {
    return aiError(error);
  }
}
