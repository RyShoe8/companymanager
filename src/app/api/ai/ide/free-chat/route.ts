import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAttentionAccess } from '@/lib/ai/control/attention';
import { AiHttpError } from '@/lib/ai/control/access';
import { aiError, aiResponse, readAiBody } from '@/lib/ai/control/http';
import { attemptDirectModelChat } from '@/lib/ai/ideDirectChat';
import { isIdeDirectMode, normalizeIdeChatMode } from '@/lib/ide/modes';
import { ideChatSchema } from '@/lib/ide/ideChatSchema';
import { appendIdeChatTurns, clearIdeChatTurnPlan, loadIdeChatHistory } from '@/lib/ide/chatHistory';
import { freeChatLedgerProjectId } from '@/lib/ide/freeChat';

export const dynamic = 'force-dynamic';

function turnPayload(turn: {
  requestId: string;
  role: 'user' | 'assistant' | 'status';
  text: string;
  failureCategory?: string;
  debugHint?: string;
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
    debugHint: turn.debugHint ?? null,
    runId: turn.runId ?? null,
    costMicros: turn.costMicros ?? null,
    reservedMicros: turn.reservedMicros ?? null,
    noProviderFee: turn.noProviderFee ?? false,
    artifacts: turn.artifacts ?? [],
    toolsUsed: turn.toolsUsed ?? [],
    ...(turn.plan ? { plan: turn.plan } : {}),
  };
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireAttentionAccess(request);
    const modeRaw = request.nextUrl.searchParams.get('mode')?.trim() ?? '';
    const mode = normalizeIdeChatMode(modeRaw);
    if (!mode || !isIdeDirectMode(mode)) {
      throw new AiHttpError(400, 'Free Chat only supports Direct mode.');
    }
    const modelProfileId = request.nextUrl.searchParams.get('modelProfileId')?.trim() ?? '';
    const model = request.nextUrl.searchParams.get('model')?.trim() ?? '';
    const projectId = freeChatLedgerProjectId(access.organizationId);
    const turns = await loadIdeChatHistory({
      organizationId: access.organizationId,
      projectId,
      userId: access.userId,
      mode,
      modelProfileId,
      model,
    });
    return aiResponse({ mode, turns, freeChat: true });
  } catch (error) {
    return aiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireAttentionAccess(request);
    const input = ideChatSchema.parse(await readAiBody(request));
    if (!isIdeDirectMode(input.mode)) {
      throw new AiHttpError(400, 'Free Chat only supports Direct mode.');
    }
    if (!input.modelProfileId?.trim() || !input.model?.trim()) {
      throw new AiHttpError(400, 'Choose a company credential and model for Free Chat.');
    }

    const projectId = freeChatLedgerProjectId(access.organizationId);
    const userRequestId = randomUUID();
    const turn = await attemptDirectModelChat({
      projectName: 'Free Chat',
      organizationId: access.organizationId,
      projectId,
      userId: access.userId,
      userText: input.text,
      priorTurns: input.history,
      modelProfileId: input.modelProfileId,
      model: input.model,
      ruleTexts: [],
      interactionMode: input.interactionMode,
      includeRepoTools: false,
      signal: request.signal,
    });
    const payload = turnPayload(turn);
    await appendIdeChatTurns({
      organizationId: access.organizationId,
      projectId,
      userId: access.userId,
      mode: input.mode,
      modelProfileId: input.modelProfileId,
      model: input.model,
      turns: [
        {
          requestId: userRequestId,
          role: 'user',
          text: input.text,
        },
        {
          requestId: payload.requestId,
          role: payload.role,
          text: payload.text,
          failureCategory: payload.failureCategory ?? null,
          runId: payload.runId ?? null,
          costMicros: payload.costMicros ?? null,
          reservedMicros: payload.reservedMicros ?? null,
          noProviderFee: payload.noProviderFee ?? false,
          toolsUsed: payload.toolsUsed ?? [],
          artifacts: payload.artifacts ?? [],
          plan: payload.plan ?? null,
        },
      ],
    });
    return aiResponse({
      turn: payload,
      mode: input.mode,
      employee: null,
      modelProfileId: input.modelProfileId,
      model: input.model,
      rulesApplied: 0,
      freeChat: true,
    });
  } catch (error) {
    return aiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await requireAttentionAccess(request);
    const requestId = request.nextUrl.searchParams.get('requestId')?.trim() ?? '';
    if (!requestId) {
      throw new AiHttpError(400, 'Provide the chat turn requestId to reject.');
    }
    const cleared = await clearIdeChatTurnPlan({
      organizationId: access.organizationId,
      projectId: freeChatLedgerProjectId(access.organizationId),
      userId: access.userId,
      requestId,
    });
    return aiResponse({ ok: true, cleared, freeChat: true });
  } catch (error) {
    return aiError(error);
  }
}
