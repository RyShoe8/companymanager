import type { IProjectTask } from '@/lib/models/Project';

/** Legacy task edits may not erase or forge approved-plan provenance. Stable IDs only. */
export function preserveTaskAiMetadata(incoming: { _id?: unknown }, previous?: IProjectTask) {
  if (!incoming._id || !previous?._id || String(incoming._id) !== String(previous._id)) return {};
  return {
    objectiveId: previous.objectiveId, aiPlanId: previous.aiPlanId,
    acceptanceCriteria: previous.acceptanceCriteria,
    dependencyTaskIds: previous.dependencyTaskIds,
  };
}
