import type { IdeInteractionMode } from '@/lib/ide/idePlan';

const PLAN_INSTRUCTIONS = [
  'You are in Plan mode. Draft a clear implementation plan only.',
  'Do not call tools. Do not claim work is already done or files were edited.',
  'Write a concise human-readable plan, then end with a fenced JSON block tagged nucleas-plan exactly like:',
  '```nucleas-plan',
  '{"title":"...","summary":"...","steps":["..."]}',
  '```',
  'After the fence, add one short line telling the user the plan is ready to review in the center pane.',
].join(' ');

const BUILD_INSTRUCTIONS = [
  'The user approved the plan below. Execute it step by step.',
  'Use tools when available. Do not rewrite the whole plan unless asked.',
  'Report concrete progress; do not invent completed file edits without tool or user confirmation.',
].join(' ');

/** Append plan/build instructions to a base system prompt. Chat mode returns base unchanged. */
export function appendInteractionModePrompt(
  baseSystemPrompt: string,
  interactionMode: IdeInteractionMode
): string {
  if (interactionMode === 'plan') return `${baseSystemPrompt} ${PLAN_INSTRUCTIONS}`;
  if (interactionMode === 'build') return `${baseSystemPrompt} ${BUILD_INSTRUCTIONS}`;
  return baseSystemPrompt;
}

export function shouldForcePlainChat(interactionMode: IdeInteractionMode): boolean {
  return interactionMode === 'plan';
}
