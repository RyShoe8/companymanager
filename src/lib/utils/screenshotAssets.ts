export function screenshotAssetsUrl(params: {
  entityType: 'project' | 'projectTask' | 'contentItem';
  entityId: string;
  taskId?: string;
  taskIndex?: number;
}): string {
  let url = '/api/assets?type=screenshot';
  if (params.entityType === 'projectTask') {
    url += `&linkedProjectId=${encodeURIComponent(params.entityId)}`;
    if (params.taskId) {
      url += `&linkedProjectTaskId=${params.taskId}`;
    } else if (params.taskIndex !== undefined) {
      url += `&linkedProjectTaskIndex=${params.taskIndex}`;
    }
  } else if (params.entityType === 'project') {
    url += `&linkedProjectId=${params.entityId}`;
  } else if (params.entityType === 'contentItem') {
    url += `&linkedContentItemId=${params.entityId}`;
  }
  return url;
}
