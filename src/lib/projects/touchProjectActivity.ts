import { Types } from 'mongoose';
import Project from '@/lib/models/Project';
import ContentItem from '@/lib/models/ContentItem';

export async function touchProjectActivity(projectId: string): Promise<void> {
  if (!Types.ObjectId.isValid(projectId)) return;
  await Project.findByIdAndUpdate(projectId, { $set: { updatedAt: new Date() } });
}

export async function resolveProjectIdFromCommentEntity(
  entityType: string,
  entityId: string
): Promise<string | null> {
  if (!Types.ObjectId.isValid(entityId)) return null;

  if (entityType === 'project' || entityType === 'projectTask') {
    return entityId;
  }

  if (entityType === 'contentItem') {
    const item = await ContentItem.findById(entityId).select('projectId').lean();
    const projectId = (item as { projectId?: Types.ObjectId } | null)?.projectId;
    return projectId?.toString() ?? null;
  }

  return null;
}
