import type { IdeInteractionMode, IdeRunActivity } from '@/lib/ide/idePlan';

export type RunSceneInput = {
  busy: boolean;
  interactionMode: IdeInteractionMode;
  targetLabel?: string;
  toolsUsed?: string[];
  planReady?: boolean;
  failed?: boolean;
  /** Cosmetic sub-step while busy (0 = just sent, higher = later pacing). */
  busyTick?: number;
};

/** Map client busy/mode signals to diorama phase + label. Zero network / model usage. */
export function runSceneFromState(input: RunSceneInput): IdeRunActivity {
  const mode = input.interactionMode;
  if (input.failed) {
    return { phase: 'error', label: 'Hit a snag', interactionMode: mode, busy: false };
  }
  if (input.planReady && !input.busy) {
    return {
      phase: 'plan_ready',
      label: 'Plan ready — review on the board',
      interactionMode: mode,
      busy: false,
    };
  }
  if (!input.busy) {
    if (input.toolsUsed?.length) {
      return {
        phase: 'tools',
        label: `Used tools: ${input.toolsUsed.slice(0, 4).join(', ')}`,
        interactionMode: mode,
        busy: false,
      };
    }
    return { phase: 'idle', label: 'Office is quiet', interactionMode: mode, busy: false };
  }

  const target = input.targetLabel?.trim();
  const tick = input.busyTick ?? 0;
  if (tick <= 0) {
    return {
      phase: 'sending',
      label: target ? `Sending to ${target}…` : 'Sending…',
      interactionMode: mode,
      busy: true,
    };
  }
  if (mode === 'plan') {
    return {
      phase: 'working',
      label: 'Drafting plan at the desk…',
      interactionMode: mode,
      busy: true,
    };
  }
  if (mode === 'build') {
    return {
      phase: 'building',
      label: 'Building the approved plan…',
      interactionMode: mode,
      busy: true,
    };
  }
  return {
    phase: 'working',
    label: 'Working with the model…',
    interactionMode: mode,
    busy: true,
  };
}
