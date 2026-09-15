import 'server-only';
import { attemptCompanyCredentialChat } from '@/lib/ai/companyChat';
import type { TeamChatTurn } from '@/lib/ai/teamChat';
import type { IdeInteractionMode } from '@/lib/ide/idePlan';
import { appendInteractionModePrompt, shouldForcePlainChat } from '@/lib/ide/planModePrompt';
import { parseNucleasPlan } from '@/lib/ide/parseNucleasPlan';
import { Types } from 'mongoose';

/**
 * Single-model IDE chat via a company credential (Direct mode).
 * Uses pipeline admission + tool loop (not the platform shared bearer).
 */
export async function attemptDirectModelChat(input: {
  projectName: string;
  organizationId: string;
  projectId: Types.ObjectId;
  userId: string;
  userText: string;
  priorTurns: { role: 'user' | 'assistant' | 'status'; text: string }[];
  modelProfileId: string;
  model: string;
  ruleTexts?: string[];
  interactionMode?: IdeInteractionMode;
  signal?: AbortSignal;
}): Promise<TeamChatTurn> {
  const interactionMode = input.interactionMode ?? 'chat';
  const allowTools = interactionMode !== 'plan';

  const ruleBlock =
    input.ruleTexts && input.ruleTexts.length > 0
      ? ['Project task rules you must follow:', ...input.ruleTexts.map((rule, index) => `${index + 1}. ${rule}`)].join(
          '\n'
        )
      : null;
  const basePrompt = [
    `You are a helpful assistant on the Nucleas project "${input.projectName}".`,
    'Reply helpfully and briefly. Do not claim to have changed project data or completed tasks outside this chat.',
    allowTools
      ? 'You may call provided tools (web_search, web_fetch, browser_navigate when available, image_generate). Never claim browse or image results without tool output. If a tool fails, say so from the error—do not invent results.'
      : 'Do not call tools in this turn.',
    allowTools
      ? 'Prefer web_search/web_fetch; use browser_navigate only when fetch is thin or JS rendering is required.'
      : '',
    'If you lack information or tools, say what is missing instead of inventing facts.',
    ...(ruleBlock ? [ruleBlock] : []),
  ]
    .filter(Boolean)
    .join(' ');

  const turn = await attemptCompanyCredentialChat({
    systemPrompt: appendInteractionModePrompt(basePrompt, interactionMode),
    organizationId: input.organizationId,
    projectId: input.projectId,
    userId: input.userId,
    userText: input.userText,
    priorTurns: input.priorTurns,
    modelProfileId: input.modelProfileId,
    model: input.model,
    includeImageTool: allowTools,
    forcePlain: shouldForcePlainChat(interactionMode),
    signal: input.signal,
  });

  if (interactionMode === 'plan' && turn.role === 'assistant') {
    const parsed = parseNucleasPlan(turn.text);
    if (parsed) {
      return { ...turn, text: parsed.displayText, plan: parsed.plan };
    }
  }
  return turn;
}
