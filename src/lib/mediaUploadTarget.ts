/** Shared target for screenshot and recording uploads linked to workspace entities. */
export type MediaUploadTarget = {
  entityType: 'project' | 'projectTask' | 'contentItem' | 'client';
  entityId: string;
  taskId?: string;
  taskIndex?: number;
};

export function mediaTargetToRecordingFields(target: MediaUploadTarget | null): {
  projectId?: string;
  taskId?: string;
  contentItemId?: string;
} {
  if (!target) return {};
  if (target.entityType === 'project') {
    return { projectId: target.entityId };
  }
  if (target.entityType === 'projectTask') {
    return {
      projectId: target.entityId,
      taskId: target.taskId,
    };
  }
  if (target.entityType === 'contentItem') {
    return { contentItemId: target.entityId };
  }
  // Recordings have no clientId field — leave unlinked rather than mis-label as a project.
  return {};
}
