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

function stageBusyLabel(stage: IdeChatStage, deskLabel?: string): string {
  const who = deskLabel?.trim();
  if (stage === 'planner') return who ? `${who} drafting plan…` : 'Planner drafting…';
  if (stage === 'reviewer') return who ? `${who} reviewing…` : 'Reviewer checking…';
  if (stage === 'direct') return who ? `${who} typing…` : 'Model typing…';
  return who ? `${who} building…` : 'Worker building…';
}

/** Map client busy/mode signals to diorama phase + label. Zero network / model usage. */
export function runSceneFromState(input: RunSceneInput): IdeRunActivity {
  const mode = input.interactionMode;
  const desks = input.desks;
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
    const quiet =
      desks && desks.length > 1
        ? `${desks.map((d) => d.modelLabel).join(' · ')} standing by`
        : desks?.[0]?.modelLabel
          ? `${desks[0].modelLabel} is quiet`
          : 'Standing by';
    return { phase: 'idle', label: quiet, interactionMode: mode, busy: false, desks };
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
  if (live) {
    const phase =
      live === 'reviewer' || mode === 'build'
        ? live === 'reviewer'
          ? 'working'
          : 'building'
        : live === 'planner' || mode === 'plan'
          ? 'working'
          : 'working';
    return {
      phase: mode === 'build' && live !== 'reviewer' ? 'building' : phase,
      label: stageBusyLabel(live, activeDesk(desks)?.modelLabel),
      interactionMode: mode,
      busy: true,
      desks,
    };
  }

  if (mode === 'plan') {
    return {
      phase: 'working',
      label: activeDesk(desks)?.modelLabel
        ? `${activeDesk(desks)!.modelLabel} drafting plan…`
        : 'Drafting plan at the desk…',
      interactionMode: mode,
      busy: true,
      desks,
    };
  }
  if (mode === 'build') {
    return {
      phase: 'building',
      label: activeDesk(desks)?.modelLabel
        ? `${activeDesk(desks)!.modelLabel} building…`
        : 'Building the approved plan…',
      interactionMode: mode,
      busy: true,
      desks,
    };
  }
  const workingLabel = activeDesk(desks)?.modelLabel ?? (target ? target : 'model');
  return {
    phase: 'working',
    label: `${workingLabel} typing…`,
    interactionMode: mode,
    busy: true,
    desks,
  };
}
