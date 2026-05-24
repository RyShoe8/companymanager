import type { IAsset } from '@/lib/models/Asset';

export type ScreenshotUploadTarget = {
  entityType: 'project' | 'projectTask' | 'contentItem';
  entityId: string;
  taskId?: string;
  taskIndex?: number;
};

function appendTargetToFormData(formData: FormData, target: ScreenshotUploadTarget): void {
  if (target.entityType === 'project' || target.entityType === 'projectTask') {
    formData.append('linkedProjectId', target.entityId);
    if (target.entityType === 'projectTask') {
      if (target.taskId) {
        formData.append('linkedProjectTaskId', target.taskId);
      } else if (target.taskIndex !== undefined) {
        formData.append('linkedProjectTaskIndex', target.taskIndex.toString());
      }
    }
  } else if (target.entityType === 'contentItem') {
    formData.append('linkedContentItemId', target.entityId);
  }
}

export async function uploadScreenshotAsset(
  file: File,
  target: ScreenshotUploadTarget,
  options?: { name?: string }
): Promise<IAsset> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append(
    'name',
    options?.name?.trim() || file.name.replace(/\.[^/.]+$/, '') || 'Screenshot'
  );
  formData.append('type', 'screenshot');
  appendTargetToFormData(formData, target);

  const response = await fetch('/api/assets/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to upload screenshot.');
  }

  return response.json();
}
