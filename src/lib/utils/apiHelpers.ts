import User from '@/lib/models/User';
import Project from '@/lib/models/Project';
import Operation from '@/lib/models/Operation';
import { Types } from 'mongoose';

/**
 * Get organization user IDs for a given user
 * Used across many API routes to filter by organization
 * Note: organizationId is stored as a string in the User model
 */
export async function getOrganizationUserIds(userId: string | Types.ObjectId, organizationId: string | Types.ObjectId): Promise<Types.ObjectId[]> {
  // organizationId is stored as string in User model, so convert ObjectId to string if needed
  const orgId = typeof organizationId === 'string' ? organizationId : organizationId.toString();
  const orgUsers = await User.find({ organizationId: orgId });
  
  // Ensure we return proper ObjectIds - convert string IDs to ObjectId if needed
  const userIds = orgUsers.map(u => {
    if (typeof u._id === 'string') {
      return new Types.ObjectId(u._id);
    }
    return u._id;
  });
  
  // Ensure the current user is included (in case of any edge cases)
  const currentUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const currentUserIdString = currentUserId.toString();
  if (!userIds.some(id => id.toString() === currentUserIdString)) {
    userIds.push(currentUserId);
  }
  
  // Return unique IDs only
  const uniqueIds = Array.from(new Set(userIds.map(id => id.toString()))).map(id => new Types.ObjectId(id));
  
  return uniqueIds;
}

/**
 * Map stage status to task status for migration
 */
export function mapStageStatusToTaskStatus(stageStatus: string): 'planning' | 'active' | 'in-review' | 'complete' {
  switch (stageStatus) {
    case 'in-development':
      return 'active';
    case 'launched':
      return 'complete';
    case 'in-review':
      return 'in-review';
    case 'planning':
    default:
      return 'planning';
  }
}

/**
 * Migrate stages to tasks for backward compatibility
 * Returns the project with migrated tasks if migration occurred
 */
export function migrateStagesToTasks(project: any): any {
  if ((!project.tasks || project.tasks.length === 0) && project.stages && project.stages.length > 0) {
    project.tasks = project.stages.map((stage: any) => ({
      name: stage.name,
      description: stage.description,
      startDate: stage.startDate,
      endDate: stage.endDate,
      estimatedHours: stage.estimatedHours,
      assignedTo: stage.assignedTo,
      status: mapStageStatusToTaskStatus(stage.status),
    }));
  }
  return project;
}

/**
 * Clean up launched projects by clearing tasks if operations exist
 * This prevents duplicates when tasks have been converted to operations
 */
export async function cleanupLaunchedProjectTasks(projectId: string | Types.ObjectId, projectStatus: string, projectTasks: any[] | undefined): Promise<void> {
  if (projectStatus === 'launched' && projectTasks && projectTasks.length > 0) {
    // Convert string to ObjectId if needed
    const projId = typeof projectId === 'string' ? new Types.ObjectId(projectId) : projectId;
    const existingOperations = await Operation.find({ projectId: projId }).lean();
    if (existingOperations.length > 0) {
      // Clear tasks since they've been converted to operations
      await Project.findByIdAndUpdate(projId, { tasks: [] }, { new: true }).catch(() => {
        // Error cleaning up tasks
      });
    }
  }
}
