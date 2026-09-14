import { aiEmployees, type AiEmployeeKey } from '@/lib/ai/teamWorkspace';

/** Legacy IDE tab ids → AI Team employee keys. */
const legacyIdeModeToEmployee = {
  plan: 'product',
  build: 'engineering',
  research: 'researcher',
} as const;

type LegacyIdeMode = keyof typeof legacyIdeModeToEmployee;

/** IDE chat modes: one tab per AI Team role + Direct single-model chat. */
export const ideChatModes = [
  ...aiEmployees.map((role) => ({
    id: role.id,
    label: role.name,
    employee: role.id as AiEmployeeKey,
  })),
  { id: 'direct' as const, label: 'Direct', employee: null },
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

/** Accept current employee ids and legacy Plan/Build/Research aliases. */
export function normalizeIdeChatMode(value: string): IdeChatMode | null {
  if (isIdeChatMode(value)) return value;
  if (value in legacyIdeModeToEmployee) {
    return legacyIdeModeToEmployee[value as LegacyIdeMode];
  }
  return null;
}

export function employeeForIdeMode(mode: IdeWorkerMode): AiEmployeeKey {
  return mode;
}

/** Modes to match when loading task rules (includes legacy aliases). */
export function taskRuleModeQueryValues(mode: IdeChatMode): string[] {
  if (mode === 'direct') return ['all', 'direct'];
  const legacy = (Object.entries(legacyIdeModeToEmployee) as [LegacyIdeMode, AiEmployeeKey][]).find(
    ([, employee]) => employee === mode
  )?.[0];
  return legacy ? ['all', mode, legacy] : ['all', mode];
}
