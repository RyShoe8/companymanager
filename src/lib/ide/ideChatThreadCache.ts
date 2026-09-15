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
  return [
    {
      role: 'planner',
      modelLabel: stages.planner?.trim() || 'Planner',
      active: false,
    },
    {
      role: 'worker',
      modelLabel: stages.worker?.trim() || 'Worker',
      active: Boolean(input.busy),
    },
    {
      role: 'reviewer',
      modelLabel: stages.reviewer?.trim() || 'Reviewer',
      active: false,
    },
  ];
}
