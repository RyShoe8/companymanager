import type { IdeInteractionMode, IdeRunActivity } from '@/lib/ide/idePlan';
import type { IdeDioramaDesk } from '@/lib/ide/ideChatThreadCache';
import type { IdeChatStage } from '@/lib/ide/ideChatStream';

export type RunSceneInput = {
  busy: boolean;
  interactionMode: IdeInteractionMode;
  targetLabel?: string;
  toolsUsed?: string[];
  planReady?: boolean;
  failed?: boolean;
  /** Cosmetic sub-step while busy (0 = just sent, higher = later pacing). */
  busyTick?: number;
  desks?: IdeDioramaDesk[];
  /** Live pipeline stage from NDJSON (overrides mode-based labels when set). */
  liveStage?: IdeChatStage | null;
};

function activeDesk(desks?: IdeDioramaDesk[]): IdeDioramaDesk | undefined {
  return desks?.find((d) => d.status === 'active' || d.active);
}

/** Short verb for the desk chip (no model name — name is already above the desk). */
export function deskActivityVerb(
  role: IdeChatStage,
  status: IdeDioramaDesk['status'],
  mode: IdeInteractionMode,
  busy: boolean
): string | undefined {
  if (!busy) return undefined;
  if (status === 'done') return 'finished';
  if (status === 'idle') return 'on standby…';
  if (role === 'planner') {
    if (mode === 'plan') return 'writing a plan…';
    if (mode === 'build') return 'handing off…';
    return 'planning…';
  }
  if (role === 'worker') {
    if (mode === 'build') return 'making changes…';
    if (mode === 'plan') return 'checking the repo…';
    return 'looking through the code…';
  }
  if (role === 'reviewer') {
    if (mode === 'plan') return 'reviewing the plan…';
    if (mode === 'build') return 'reviewing changes…';
    return 'writing the answer…';
  }
  return 'working…';
}

function withDeskActivityLabels(
  desks: IdeDioramaDesk[] | undefined,
  mode: IdeInteractionMode,
  busy: boolean
): IdeDioramaDesk[] | undefined {
  if (!desks?.length) return desks;
  return desks.map((desk) => ({
    ...desk,
    activityLabel: deskActivityVerb(desk.role, desk.status, mode, busy),
  }));
}

function floorLabel(input: {
  mode: IdeInteractionMode;
  busy: boolean;
  live?: IdeChatStage | null;
  target?: string;
  desks?: IdeDioramaDesk[];
}): string {
  if (!input.busy) {
    return input.desks && input.desks.length > 1 ? 'Team floor · quiet' : 'Standing by';
  }
  if (input.live === 'planner') return 'Team floor · planning';
  if (input.live === 'worker') return input.mode === 'build' ? 'Team floor · building' : 'Team floor · researching';
  if (input.live === 'reviewer') return 'Team floor · reviewing';
  if (input.live === 'direct') return input.target ? `Working · ${input.target}` : 'Team floor · working';
  return 'Team floor · working';
}

/** Map client busy/mode signals to diorama phase + label. Zero network / model usage. */
export function runSceneFromState(input: RunSceneInput): IdeRunActivity {
  const mode = input.interactionMode;
  const desks = withDeskActivityLabels(input.desks, mode, input.busy);

  if (input.failed) {
    return { phase: 'error', label: 'Hit a snag', interactionMode: mode, busy: false, desks };
  }
  if (input.planReady && !input.busy) {
    return {
      phase: 'plan_ready',
      label: 'Plan ready — review on the board',
      interactionMode: mode,
      busy: false,
      desks,
    };
  }
  if (!input.busy) {
    if (input.toolsUsed?.length) {
      return {
        phase: 'tools',
        label: `Used tools: ${input.toolsUsed.slice(0, 4).join(', ')}`,
        interactionMode: mode,
        busy: false,
        desks,
      };
    }
    return {
      phase: 'idle',
      label: floorLabel({ mode, busy: false, desks }),
      interactionMode: mode,
      busy: false,
      desks,
    };
  }

  const target = input.targetLabel?.trim();
  const tick = input.busyTick ?? 0;
  if (tick <= 0 && !input.liveStage) {
    return {
      phase: 'sending',
      label: target ? `Sending to ${target}…` : 'Sending…',
      interactionMode: mode,
      busy: true,
      desks,
    };
  }

  const live = input.liveStage ?? activeDesk(desks)?.role ?? null;
  const phase: IdeRunActivity['phase'] =
    mode === 'build' && live !== 'reviewer' ? 'building' : 'working';

  return {
    phase,
    label: floorLabel({ mode, busy: true, live, target, desks }),
    interactionMode: mode,
    busy: true,
    desks,
  };
}
