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
import { appendIdeChatTurns, clearIdeChatTurnPlan, loadIdeChatHistory } from '@/lib/ide/chatHistory';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

function turnPayload(turn: {
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
  plan?: {
    title: string;
    summary: string;
    steps: string[];
    markdown: string;
    status: 'ready_for_review' | 'approved' | 'building';
  };
}) {
  return {
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
    ...(turn.plan ? { plan: turn.plan } : {}),
  };
}

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

    const persistPair = async (reply: ReturnType<typeof turnPayload>) => {
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
            plan: reply.plan ?? null,
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
        interactionMode: input.interactionMode,
        signal: request.signal,
      });
      const payload = turnPayload(turn);
      await persistPair(payload);
      return aiResponse({
        turn: payload,
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
      interactionMode: input.interactionMode,
      signal: request.signal,
    });
    const payload = turnPayload(turn);
    await persistPair(payload);
    return aiResponse({
      turn: payload,
      mode,
      employee,
      rulesApplied: ruleTexts.length,
    });
  } catch (error) {
    return aiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const access = await requireAiProject(request, (await context.params).id, false, true);
    const requestId = request.nextUrl.searchParams.get('requestId')?.trim() ?? '';
    if (!requestId) {
      throw new AiHttpError(400, 'Provide the chat turn requestId to reject.');
    }
    const cleared = await clearIdeChatTurnPlan({
      organizationId: access.organizationId,
      projectId: access.project._id,
      userId: access.userId,
      requestId,
    });
    return aiResponse({ ok: true, cleared });
  } catch (error) {
    return aiError(error);
  }
}
