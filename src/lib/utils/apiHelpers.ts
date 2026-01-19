import User from '@/lib/models/User';
import Project from '@/lib/models/Project';
import Operation from '@/lib/models/Operation';
import { Types } from 'mongoose';

/**
 * Get organization user IDs for a given user
 * Used across many API routes to filter by organization
 */
export async function getOrganizationUserIds(userId: Types.ObjectId, organizationId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const orgUsers = await User.find({ organizationId });
  return orgUsers.map(u => u._id);
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
export async function cleanupLaunchedProjectTasks(projectId: Types.ObjectId, projectStatus: string, projectTasks: any[]): Promise<void> {
  if (projectStatus === 'launched' && projectTasks && projectTasks.length > 0) {
    const existingOperations = await Operation.find({ projectId }).lean();
    if (existingOperations.length > 0) {
      // Clear tasks since they've been converted to operations
      await Project.findByIdAndUpdate(projectId, { tasks: [] }, { new: true }).catch((err: any) => 
        console.error('Error cleaning up tasks:', err)
      );
    }
  }
}
