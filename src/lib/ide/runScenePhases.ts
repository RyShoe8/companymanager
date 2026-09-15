import type { IdeInteractionMode, IdeRunActivity } from '@/lib/ide/idePlan';
import type { IdeDioramaDesk } from '@/lib/ide/ideChatThreadCache';

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
};

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
  if (tick <= 0) {
    return {
      phase: 'sending',
      label: target ? `Sending to ${target}…` : 'Sending…',
      interactionMode: mode,
      busy: true,
      desks,
    };
  }
  if (mode === 'plan') {
    return {
      phase: 'working',
      label: desks?.find((d) => d.active)?.modelLabel
        ? `${desks.find((d) => d.active)!.modelLabel} drafting plan…`
        : 'Drafting plan at the desk…',
      interactionMode: mode,
      busy: true,
      desks,
    };
  }
  if (mode === 'build') {
    return {
      phase: 'building',
      label: desks?.find((d) => d.active)?.modelLabel
        ? `${desks.find((d) => d.active)!.modelLabel} building…`
        : 'Building the approved plan…',
      interactionMode: mode,
      busy: true,
      desks,
    };
  }
  const workingLabel = desks?.find((d) => d.active)?.modelLabel ?? (target ? target : 'model');
  return {
    phase: 'working',
    label: `${workingLabel} typing…`,
    interactionMode: mode,
    busy: true,
    desks,
  };
}
