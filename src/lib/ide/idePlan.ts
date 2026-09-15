export const ideInteractionModes = ['chat', 'plan', 'build'] as const;
export type IdeInteractionMode = (typeof ideInteractionModes)[number];

export function isIdeInteractionMode(value: string): value is IdeInteractionMode {
  return (ideInteractionModes as readonly string[]).includes(value);
}

export type IdePlanDocument = {
  title: string;
  summary: string;
  steps: string[];
  markdown: string;
  status: 'ready_for_review' | 'approved' | 'building';
};

export type IdeRunActivity = {
  phase: 'idle' | 'sending' | 'working' | 'plan_ready' | 'building' | 'tools' | 'error';
  label: string;
  interactionMode: IdeInteractionMode;
  busy: boolean;
};
