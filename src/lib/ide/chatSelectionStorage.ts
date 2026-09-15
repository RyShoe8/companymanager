import { isIdeChatMode, normalizeIdeChatMode, type IdeChatMode } from '@/lib/ide/modes';
import { isIdeInteractionMode, type IdeInteractionMode } from '@/lib/ide/idePlan';

const MODE_KEY_PREFIX = 'nucleas.ide.chatMode.';
const DIRECT_KEY_PREFIX = 'nucleas.ide.directSelection.';
const INTERACTION_KEY_PREFIX = 'nucleas.ide.interactionMode.';

export type IdeDirectSelection = {
  profileId: string;
  model: string;
};

function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readStoredIdeChatMode(projectId: string): IdeChatMode | null {
  if (!projectId) return null;
  const raw = storageGet(`${MODE_KEY_PREFIX}${projectId}`);
  if (!raw) return null;
  return normalizeIdeChatMode(raw) ?? (isIdeChatMode(raw) ? raw : null);
}

export function writeStoredIdeChatMode(projectId: string, mode: IdeChatMode): void {
  if (!projectId) return;
  storageSet(`${MODE_KEY_PREFIX}${projectId}`, mode);
}

export function readStoredIdeInteractionMode(projectId: string): IdeInteractionMode | null {
  if (!projectId) return null;
  const raw = storageGet(`${INTERACTION_KEY_PREFIX}${projectId}`);
  if (!raw || !isIdeInteractionMode(raw)) return null;
  // Persist only chat|plan; build is ephemeral per Approve.
  return raw === 'build' ? 'chat' : raw;
}

export function writeStoredIdeInteractionMode(
  projectId: string,
  mode: Exclude<IdeInteractionMode, 'build'>
): void {
  if (!projectId) return;
  storageSet(`${INTERACTION_KEY_PREFIX}${projectId}`, mode);
}

export function readStoredIdeDirectSelection(projectId: string): IdeDirectSelection | null {
  if (!projectId) return null;
  const raw = storageGet(`${DIRECT_KEY_PREFIX}${projectId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { profileId?: unknown; model?: unknown };
    const profileId = typeof parsed.profileId === 'string' ? parsed.profileId.trim() : '';
    const model = typeof parsed.model === 'string' ? parsed.model.trim() : '';
    if (!profileId || !model) return null;
    return { profileId, model };
  } catch {
    return null;
  }
}

export function writeStoredIdeDirectSelection(
  projectId: string,
  selection: IdeDirectSelection
): void {
  if (!projectId) return;
  const profileId = selection.profileId.trim();
  const model = selection.model.trim();
  if (!profileId || !model) return;
  storageSet(`${DIRECT_KEY_PREFIX}${projectId}`, JSON.stringify({ profileId, model }));
}
