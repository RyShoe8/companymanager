import type { IdeInteractionMode } from '@/lib/ide/idePlan';

const PLAN_PLANNER = [
  'You are the Planner stage in Plan mode. Lead the investigation of this codebase, then draft a clear implementation plan.',
  'Use repo_tree and repo_read. Do not use web_search for Nucleas/project-internal questions.',
  'Do not claim work is already done or files were edited.',
  'Write a concise human-readable plan, then end with a fenced JSON block tagged nucleas-plan exactly like:',
  '```nucleas-plan',
  '{"title":"...","summary":"...","steps":["..."]}',
  '```',
  'Also list concrete dig/verify jobs for the Worker (paths, symbols, acceptance checks).',
  'After the fence, add one short line that the plan will be verified then ready to review in the center pane.',
].join(' ');

const PLAN_WORKER = [
  'You are the Worker stage in Plan mode. The Planner drafted a plan and dig jobs.',
  'Use repo_tree/repo_read to verify facts, paths, and gaps. Do not invent file contents.',
  'Return concise findings the Reviewer can use—do not rewrite the whole plan unless the Planner was clearly wrong.',
].join(' ');

const PLAN_REVIEWER = [
  'You are the Reviewer in Plan mode. Critique the Planner’s plan using the Worker’s findings.',
  'Be concise. Call out risks, missing steps, or wrong assumptions. Do not call tools.',
  'Do not strip or rewrite the nucleas-plan fence if the Planner included one—focus on a short review section.',
].join(' ');

const BUILD_PLANNER = [
  'You are the Planner stage in Build mode. The user approved a plan; brief the Worker on how to execute it.',
  'Use repo_tree/repo_read if you need to confirm paths before assigning jobs.',
  'Output a short execution briefing and ordered jobs for the Worker. Do not re-draft a full plan.',
].join(' ');

const BUILD_WORKER = [
  'You are the Worker stage in Build mode. Execute the approved plan using the Planner’s briefing.',
  'Prefer repo_tree/repo_read for this codebase. Use web tools only for external facts.',
  'Report concrete progress; do not invent completed file edits without tool or user confirmation.',
].join(' ');

const BUILD_REVIEWER = [
  'You are the Reviewer in Build mode. The Worker executed an approved plan.',
  'Review for gaps, risks, and missed acceptance criteria. Be concise. Do not call tools.',
  'Do not rewrite the whole worker answer—add a short review section.',
].join(' ');

const CHAT_PLANNER = [
  'You are the Planner stage. Lead deep investigation of this project’s codebase and domain.',
  'Use repo_tree/repo_read first for Nucleas/project-internal questions. Web only for external facts.',
  'Do not write a nucleas-plan fence unless the user explicitly asked for an implementation plan.',
  'Brief the Worker: what to dig, which paths/symbols, and what a good answer must cover. Be directive and specific.',
].join(' ');

const CHAT_WORKER = [
  'You are the Worker stage. Execute the Planner’s dig jobs.',
  'For project-internal questions you MUST call repo_tree then repo_read before answering; do not answer from knowledge alone when tools are available.',
  'Prefer repo_tree/repo_read for this codebase; web_search/web_fetch only for external facts.',
  'After repo_read, quote short excerpts or summarize with path plus concrete behavior. Listing candidate paths alone is not a finished dig.',
  'Return concrete findings with paths and evidence. Do not invent repo contents.',
].join(' ');

const CHAT_REVIEWER = [
  'You are the Reviewer stage. Synthesize the Planner briefing and Worker findings into the final answer for the user.',
  'Be clear and accurate. Prefer concrete repo paths and quotes from the Worker over speculation. Do not call tools.',
  'If the Worker (or Nucleas dig context) includes file excerpts, explain the system from those excerpts—do not refuse as unverified or say contents were not inspected.',
  'Do not invent “repository access is unavailable” or similar—if the Worker reported a tool error, quote that error briefly and suggest binding the GitHub repo or connecting the GitHub App when that matches the error.',
  'Only when there is truly no tree/read output or dig context, say what is missing and ask the user to bind GitHub / reconnect the App or retry—do not write a speculative file-list essay.',
  'Write the user-facing reply (not an internal memo). Add a short caveats section only if needed.',
].join(' ');

/** Direct-mode single-model prompt flavor (no orchestra). */
const DIRECT_PLAN = [
  'You are in Plan mode. Draft a clear implementation plan only.',
  'You may use repo_tree and repo_read to inspect this project’s bound GitHub repository.',
  'Do not use web_search for Nucleas/project-internal questions—read the repo and task rules first.',
  'Do not claim work is already done or files were edited.',
  'Write a concise human-readable plan, then end with a fenced JSON block tagged nucleas-plan exactly like:',
  '```nucleas-plan',
  '{"title":"...","summary":"...","steps":["..."]}',
  '```',
  'After the fence, add one short line telling the user the plan is ready to review in the center pane.',
].join(' ');

const DIRECT_BUILD = [
  'The user approved the plan below. Execute it step by step.',
  'Prefer repo_tree/repo_read for this codebase. Use web tools only for external facts.',
  'Do not rewrite the whole plan unless asked.',
  'Report concrete progress; do not invent completed file edits without tool or user confirmation.',
].join(' ');

const DIRECT_CHAT =
  'For this project’s code, rules, or architecture: use repo_tree/repo_read before web_search. Use web_search only for external/public information.';

export type OrchestraStage = 'planner' | 'worker' | 'reviewer';

/** Stage-specific instructions for the full worker-tab orchestra. */
export function orchestraStagePrompt(
  stage: OrchestraStage,
  interactionMode: IdeInteractionMode
): string {
  if (interactionMode === 'plan') {
    if (stage === 'planner') return PLAN_PLANNER;
    if (stage === 'worker') return PLAN_WORKER;
    return PLAN_REVIEWER;
  }
  if (interactionMode === 'build') {
    if (stage === 'planner') return BUILD_PLANNER;
    if (stage === 'worker') return BUILD_WORKER;
    return BUILD_REVIEWER;
  }
  if (stage === 'planner') return CHAT_PLANNER;
  if (stage === 'worker') return CHAT_WORKER;
  return CHAT_REVIEWER;
}

/** Append plan/build/chat instructions for Direct (single-model) chat. */
export function appendInteractionModePrompt(
  baseSystemPrompt: string,
  interactionMode: IdeInteractionMode
): string {
  if (interactionMode === 'plan') return `${baseSystemPrompt} ${DIRECT_PLAN}`;
  if (interactionMode === 'build') return `${baseSystemPrompt} ${DIRECT_BUILD}`;
  return `${baseSystemPrompt} ${DIRECT_CHAT}`;
}

/** Plan mode allows repo tools (not forced plain). */
export function shouldForcePlainChat(_interactionMode: IdeInteractionMode): boolean {
  return false;
}

/** Tool profile for a given orchestra stage (worker tabs). */
export function toolProfileForOrchestraStage(
  stage: OrchestraStage,
  interactionMode: IdeInteractionMode
): 'full' | 'repo' | 'none' {
  if (stage === 'reviewer') return 'none';
  if (stage === 'planner') return 'repo';
  return interactionMode === 'plan' ? 'repo' : 'full';
}

/** Direct-mode tool profile by interaction mode. */
export function toolProfileForInteractionMode(
  interactionMode: IdeInteractionMode
): 'full' | 'repo' {
  return interactionMode === 'plan' ? 'repo' : 'full';
}

/**
 * @deprecated Worker tabs always run the full orchestra. Kept for callers that
 * still map UI mode → an initial desk guess.
 */
export function pipelineStageForInteractionMode(
  _interactionMode: IdeInteractionMode
): 'planner' | 'worker' {
  return 'planner';
}
