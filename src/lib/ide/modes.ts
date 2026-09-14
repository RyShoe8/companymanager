import type { AiEmployeeKey } from '@/lib/ai/teamWorkspace';

/** IDE chat modes (Phase 1) mapped to AI employees. */
export const ideChatModes = [
  { id: 'plan', label: 'Plan', employee: 'product' as const },
  { id: 'build', label: 'Build', employee: 'engineering' as const },
  { id: 'research', label: 'Research', employee: 'researcher' as const },
  { id: 'marketing', label: 'Marketing', employee: 'marketing' as const },
] as const;

export type IdeChatMode = (typeof ideChatModes)[number]['id'];

export function employeeForIdeMode(mode: IdeChatMode): AiEmployeeKey {
  const found = ideChatModes.find((item) => item.id === mode);
  return found?.employee ?? 'product';
}

export function isIdeChatMode(value: string): value is IdeChatMode {
  return ideChatModes.some((item) => item.id === value);
}
