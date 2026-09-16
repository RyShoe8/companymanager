import { isIdeChatMode, normalizeIdeChatMode, type IdeChatMode } from '@/lib/ide/modes';
import { isIdeInteractionMode, type IdeInteractionMode } from '@/lib/ide/idePlan';
import { IDE_FREE_CHAT_SCOPE, isIdeFreeChatScope } from '@/lib/ide/freeChat';
import {
  clearClientIdeProjectCookie,
  isRealIdeProjectId,
  setClientIdeProjectCookie,
} from '@/lib/ide/ideProjectCookie';

const MODE_KEY_PREFIX = 'nucleas.ide.chatMode.';
const DIRECT_KEY_PREFIX = 'nucleas.ide.directSelection.';
const INTERACTION_KEY_PREFIX = 'nucleas.ide.interactionMode.';
const LAST_PROJECT_KEY = 'nucleas.ide.lastProjectId';
const LAYOUT_KEY_PREFIX = 'nucleas.ide.layout.';
const DRAFT_KEY_PREFIX = 'nucleas.ide.draft.';

export type IdeDirectSelection = {
  profileId: string;
  model: string;
};

export type IdeLayoutSnapshot = {
  treeCollapsed: boolean;
  expandedPaths: Record<string, boolean>;
  activePath: string | null;
  rulesOpen: boolean;
  centerView: 'file' | 'plan';
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

function sessionGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionSet(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function sessionRemove(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function isStoredIdeProjectId(value: string | null | undefined): value is string {
  return isRealIdeProjectId(value);
}

/** Last real Mongo project id (never __free_chat__). */
export function readStoredIdeProjectId(): string | null {
  const raw = storageGet(LAST_PROJECT_KEY)?.trim() ?? '';
  return isRealIdeProjectId(raw) ? raw : null;
}

/** Persist only real project ids — Free Chat must not clobber last project. */
export function writeStoredIdeProjectId(projectId: string): void {
  const id = projectId.trim();
  if (!isRealIdeProjectId(id)) return;
  storageSet(LAST_PROJECT_KEY, id);
  setClientIdeProjectCookie(id);
}

/** URL query → localStorage → Free Chat. */
export function resolveInitialIdeProjectId(urlProjectId?: string): string {
  if (urlProjectId && isRealIdeProjectId(urlProjectId)) return urlProjectId.trim();
  if (typeof window !== 'undefined') {
    const stored = readStoredIdeProjectId();
    if (stored) return stored;
  }
  return IDE_FREE_CHAT_SCOPE;
}

/** Soft-nav target for IDE (preserves last project). */
export function ideHrefForNavigation(): string {
  const id = readStoredIdeProjectId();
  if (!id) return '/ide';
  return `/ide?projectId=${encodeURIComponent(id)}`;
}

export function syncIdeProjectUrl(projectId: string): void {
  if (typeof window === 'undefined') return;
  const next = isIdeFreeChatScope(projectId)
    ? '/ide'
    : isRealIdeProjectId(projectId)
      ? `/ide?projectId=${encodeURIComponent(projectId.trim())}`
      : '/ide';
  if (`${window.location.pathname}${window.location.search}` === next) return;
  window.history.replaceState(window.history.state, '', next);
}

export function markExplicitFreeChatSelection(): void {
  try {
    window.localStorage.removeItem(LAST_PROJECT_KEY);
  } catch {
    /* ignore */
  }
  clearClientIdeProjectCookie();
}

export function readStoredIdeLayout(projectId: string): IdeLayoutSnapshot | null {
  if (!projectId || isIdeFreeChatScope(projectId)) return null;
  const raw = storageGet(`${LAYOUT_KEY_PREFIX}${projectId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<IdeLayoutSnapshot>;
    const expandedPaths =
      parsed.expandedPaths && typeof parsed.expandedPaths === 'object' && !Array.isArray(parsed.expandedPaths)
        ? Object.fromEntries(
            Object.entries(parsed.expandedPaths).filter(([, v]) => v === true)
          )
        : {};
    const activePath =
      typeof parsed.activePath === 'string' && parsed.activePath.trim()
        ? parsed.activePath.trim()
        : null;
    const centerView = parsed.centerView === 'plan' ? 'plan' : 'file';
    return {
      treeCollapsed: Boolean(parsed.treeCollapsed),
      expandedPaths,
      activePath,
      rulesOpen: Boolean(parsed.rulesOpen),
      centerView,
    };
  } catch {
    return null;
  }
}

export function writeStoredIdeLayout(projectId: string, layout: IdeLayoutSnapshot): void {
  if (!projectId || isIdeFreeChatScope(projectId)) return;
  storageSet(
    `${LAYOUT_KEY_PREFIX}${projectId}`,
    JSON.stringify({
      treeCollapsed: layout.treeCollapsed,
      expandedPaths: layout.expandedPaths,
      activePath: layout.activePath,
      rulesOpen: layout.rulesOpen,
      centerView: layout.centerView,
    })
  );
}

export function readStoredIdeDraft(threadKey: string): string {
  if (!threadKey) return '';
  return sessionGet(`${DRAFT_KEY_PREFIX}${threadKey}`) ?? '';
}

export function writeStoredIdeDraft(threadKey: string, draft: string): void {
  if (!threadKey) return;
  const text = draft.trimEnd();
  if (!text) {
    sessionRemove(`${DRAFT_KEY_PREFIX}${threadKey}`);
    return;
  }
  sessionSet(`${DRAFT_KEY_PREFIX}${threadKey}`, text.slice(0, 8000));
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
