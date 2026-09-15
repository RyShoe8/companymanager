import type { IdeChatMode } from '@/lib/ide/modes';
import { isIdeDirectMode } from '@/lib/ide/modes';

/** Client-side transcript cache key for IDE chat tabs. */
export function ideChatThreadCacheKey(input: {
  mode: IdeChatMode;
  modelProfileId?: string;
  model?: string;
}): string {
  if (!isIdeDirectMode(input.mode)) return `worker:${input.mode}`;
  return `direct:${input.modelProfileId?.trim() ?? ''}:${input.model?.trim() ?? ''}`;
}

export type IdeDioramaDesk = {
  role: 'direct' | 'planner' | 'worker' | 'reviewer';
  modelLabel: string;
  active: boolean;
};

export function buildDioramaDesks(input: {
  direct?: boolean;
  directModelLabel?: string;
  stages?: { planner?: string; worker?: string; reviewer?: string };
  busy?: boolean;
  /** Which stage is actually running (IDE chat/pipeline). */
  activeStage?: 'planner' | 'worker' | 'reviewer' | 'direct' | null;
}): IdeDioramaDesk[] {
  if (input.direct) {
    return [
      {
        role: 'direct',
        modelLabel: input.directModelLabel?.trim() || 'Direct',
        active: Boolean(input.busy),
      },
    ];
  }
  const stages = input.stages ?? {};
  const active = input.busy ? input.activeStage ?? 'worker' : null;
  return [
    {
      role: 'planner',
      modelLabel: stages.planner?.trim() || 'Planner',
      active: active === 'planner',
    },
    {
      role: 'worker',
      modelLabel: stages.worker?.trim() || 'Worker',
      active: active === 'worker',
    },
    {
      role: 'reviewer',
      modelLabel: stages.reviewer?.trim() || 'Reviewer',
      active: active === 'reviewer',
    },
  ];
}
