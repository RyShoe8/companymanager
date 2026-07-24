/**
 * Status mapping utilities for Plan, Build, Run workflow
 */

export type ProjectStage = 'Plan' | 'Build' | 'Run';
export type BackendProjectStatus = 'planning' | 'in-development' | 'launched' | 'in-review' | 'completed';

/** User-facing labels aligned with project inspector (InlineProjectView / ProjectForm). */
export function getProjectStatusDisplayLabel(status: string): string {
  switch (status) {
    case 'planning':
      return 'Planning';
    case 'in-development':
      return 'Building';
    case 'launched':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'in-review':
      return 'In Review';
    default:
      return status.replace(/-/g, ' ');
  }
}

/**
 * Map backend status to frontend stage
 */
export function mapStatusToStage(status: BackendProjectStatus): ProjectStage {
  switch (status) {
    case 'planning':
      return 'Plan';
    case 'in-development':
      return 'Build';
    case 'launched':
      return 'Run';
    case 'in-review':
    case 'completed':
      // These are internal states - determine stage from context
      // Default to Build for in-review, Run for completed
      return status === 'completed' ? 'Run' : 'Build';
    default:
      return 'Plan';
  }
}

/**
 * Map frontend stage to backend status
 */
function mapStageToStatus(stage: ProjectStage, currentStatus?: BackendProjectStatus): BackendProjectStatus {
  switch (stage) {
    case 'Plan':
      return 'planning';
    case 'Build':
      return 'in-development';
    case 'Run':
      return 'launched';
    default:
      return currentStatus || 'planning';
  }
}

interface StageFilterableProject {
  projectType?: string;
  status: BackendProjectStatus;
  endDate?: Date | string | null;
}

/**
 * Get all projects for a specific stage
 * Filters out projects that have passed their endDate (if set)
 */
export function getProjectsForStage<T extends StageFilterableProject>(projects: T[], stage: ProjectStage): T[] {
  const statusMap: Record<ProjectStage, BackendProjectStatus[]> = {
    Plan: ['planning'],
    Build: ['in-development', 'in-review'],
    Run: ['launched', 'completed'],
  };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return projects.filter(project => {
    // Hide client-admin projects from normal phase views
    if (project.projectType === 'client-admin') {
      return false;
    }
    
    // First check if project status matches the stage
    if (!statusMap[stage].includes(project.status)) {
      return false;
    }
    
    // If project has an endDate, check if it's still active
    if (project.endDate) {
      const endDate = new Date(project.endDate);
      endDate.setHours(0, 0, 0, 0);
      // Project stops appearing after endDate (exclusive)
      return today <= endDate;
    }
    
    // No endDate means project is always visible (until status changes)
    return true;
  });
}
