import type { IdeInteractionMode } from '@/lib/ide/idePlan';

const PLAN_INSTRUCTIONS = [
  'You are in Plan mode (Planner stage). Draft a clear implementation plan only.',
  'You may use repo_tree and repo_read to inspect this project’s bound GitHub repository.',
  'Do not use web_search for Nucleas/project-internal questions—read the repo and task rules first.',
  'Do not claim work is already done or files were edited.',
  'Write a concise human-readable plan, then end with a fenced JSON block tagged nucleas-plan exactly like:',
  '```nucleas-plan',
  '{"title":"...","summary":"...","steps":["..."]}',
  '```',
  'After the fence, add one short line telling the user the plan is ready to review in the center pane.',
].join(' ');

const BUILD_INSTRUCTIONS = [
  'The user approved the plan below. You are the Worker stage—execute it step by step.',
  'Prefer repo_tree/repo_read for this codebase. Use web tools only for external facts.',
  'Do not rewrite the whole plan unless asked.',
  'Report concrete progress; do not invent completed file edits without tool or user confirmation.',
].join(' ');

const CHAT_TOOL_HINT =
  'For this project’s code, rules, or architecture: use repo_tree/repo_read before web_search. Use web_search only for external/public information.';

/** Append plan/build instructions to a base system prompt. Chat mode returns base unchanged. */
export function appendInteractionModePrompt(
  baseSystemPrompt: string,
  interactionMode: IdeInteractionMode
): string {
  if (interactionMode === 'plan') return `${baseSystemPrompt} ${PLAN_INSTRUCTIONS}`;
  if (interactionMode === 'build') return `${baseSystemPrompt} ${BUILD_INSTRUCTIONS}`;
  return `${baseSystemPrompt} ${CHAT_TOOL_HINT}`;
}

/** Plan mode allows repo tools (not forced plain). */
export function shouldForcePlainChat(_interactionMode: IdeInteractionMode): boolean {
  return false;
}

export function toolProfileForInteractionMode(
  interactionMode: IdeInteractionMode
): 'full' | 'repo' {
  return interactionMode === 'plan' ? 'repo' : 'full';
}

/** Which pipeline stage runs for this IDE interaction. */
export function pipelineStageForInteractionMode(
  interactionMode: IdeInteractionMode
): 'planner' | 'worker' {
  return interactionMode === 'plan' ? 'planner' : 'worker';
}
