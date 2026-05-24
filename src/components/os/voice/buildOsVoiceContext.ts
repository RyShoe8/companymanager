import type { WorkspaceIntentContextPayload } from '@/lib/voice/workspaceIntentContext';
import type { OsContextSnapshot } from '@/lib/os/types';

function localTodayIso(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Build the workspace intent context payload from OS shell state. The shape
 * matches `WorkspaceIntentContextPayload` so the existing voice/palette
 * pipeline (parser, confirmation modal, intent executor) works unchanged.
 * OS-specific fields are encoded into `view` as a JSON tail so the LLM can
 * still rely on the canonical `lens`/`pathname` keys.
 */
export function buildOsVoiceContext(snapshot: OsContextSnapshot): WorkspaceIntentContextPayload {
    return {
        projectId: null,
        projectName: null,
        phase: null,
        view: {
            lens: 'os',
            pathname: '/os',
            scheduleMode: undefined,
        },
        referenceDate: localTodayIso(),
        projects: [],
        // Attach OS-specific hints as a structured extension. The parser
        // tolerates extra keys; the LLM sees them and can route accordingly.
        ...({
            osOpenModuleIds: snapshot.openModuleIds,
            osFocusedModuleId: snapshot.focusedModuleId,
        } as Record<string, unknown>),
    };
}
