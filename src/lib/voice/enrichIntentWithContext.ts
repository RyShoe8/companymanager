import type { ParsedIntent } from '@/lib/voice/IntentParser';
import type { WorkspaceIntentContextPayload } from '@/lib/voice/workspaceIntentContext';

/**
 * Apply default project from workspace context when the model omitted it.
 */
export function enrichIntentWithContext(
  intent: ParsedIntent | null,
  ctx: WorkspaceIntentContextPayload | undefined | null
): ParsedIntent | null {
  if (!intent || !ctx?.projectId) return intent;

  const slots = { ...intent.slots };

  if (intent.type === 'ADD_TASK') {
    if (!slots.projectId?.trim()) {
      slots.projectId = ctx.projectId;
    }
    if (!slots.projectName?.trim() && ctx.projectName) {
      slots.projectName = ctx.projectName;
    }
    return { ...intent, slots };
  }

  if (intent.type === 'CREATE_CONTENT') {
    if (!slots.projectId?.trim()) {
      slots.projectId = ctx.projectId;
    }
    if (!slots.project_name?.trim() && ctx.projectName) {
      slots.project_name = ctx.projectName;
    }
    return { ...intent, slots };
  }

  return intent;
}
