import 'server-only';
import { attemptCompanyCredentialChat } from '@/lib/ai/companyChat';
import type { TeamChatTurn } from '@/lib/ai/teamChat';
import { isFreeCredential } from '@/lib/ai/rolePipeline/modelMeta';
import { gatewayFromModelProfile } from '@/lib/ai/rolePipeline/profiles';
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
  let allowTools = interactionMode !== 'plan';
  try {
    const { profile } = await gatewayFromModelProfile(input.modelProfileId, input.model);
    if (isFreeCredential({ provider: profile.provider, tier: profile.tier })) {
      allowTools = false;
    }
  } catch {
    /* companyChat will surface credential errors */
  }

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
      ? 'You may call provided tools (web_search, web_fetch, browser_navigate when available, image_generate). Never claim browse or image results without tool output.'
      : interactionMode === 'plan'
        ? 'Do not call tools in this turn.'
        : 'Tools (including image generation) are not available on this free/local credential. Say so clearly if the user asks for images or browsing; suggest a commercial OpenAI-style Direct credential for image tools.',
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
    forcePlain: shouldForcePlainChat(interactionMode) || !allowTools,
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
