import type { AiEmployeeKey } from '@/lib/ai/teamWorkspace';

/** IDE chat modes: worker presets + Direct single-model chat. */
export const ideChatModes = [
  { id: 'plan', label: 'Plan', employee: 'product' as const },
  { id: 'build', label: 'Build', employee: 'engineering' as const },
  { id: 'research', label: 'Research', employee: 'researcher' as const },
  { id: 'marketing', label: 'Marketing', employee: 'marketing' as const },
  { id: 'direct', label: 'Direct', employee: null },
] as const;

export type IdeChatMode = (typeof ideChatModes)[number]['id'];
export type IdeWorkerMode = Exclude<IdeChatMode, 'direct'>;

export function isIdeChatMode(value: string): value is IdeChatMode {
  return ideChatModes.some((item) => item.id === value);
}

export function isIdeWorkerMode(value: string): value is IdeWorkerMode {
  return isIdeChatMode(value) && value !== 'direct';
}

export function isIdeDirectMode(value: string): value is 'direct' {
  return value === 'direct';
}

export function employeeForIdeMode(mode: IdeWorkerMode): AiEmployeeKey {
  const found = ideChatModes.find((item) => item.id === mode);
  if (!found || found.employee == null) return 'product';
  return found.employee;
}
