import type { IEmployee } from '@/lib/models/Employee';
import type { IProject, IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import { parseDateSafe } from '@/lib/utils/dateUtils';

export type ProjectStage = 'Plan' | 'Build' | 'Run';
export type StageHoursBreakdown = Record<ProjectStage, number>;
export type UtilizationBreakdownMode = 'committed' | 'completed';

export type HoursInRangeFn = (
  rangeStart: Date,
  rangeEnd: Date,
  itemStart: Date,
  itemEnd: Date,
  totalHours: number
) => number;

export function emptyStageBreakdown(): StageHoursBreakdown {
  return { Plan: 0, Build: 0, Run: 0 };
}

export function roundStageBreakdown(breakdown: StageHoursBreakdown): StageHoursBreakdown {
  return {
    Plan: Math.round(breakdown.Plan * 100) / 100,
    Build: Math.round(breakdown.Build * 100) / 100,
    Run: Math.round(breakdown.Run * 100) / 100,
  };
}

export function sumStageBreakdown(breakdown: StageHoursBreakdown): number {
  return breakdown.Plan + breakdown.Build + breakdown.Run;
}

export function getProjectStage(status: string): ProjectStage {
  if (status === 'planning') return 'Plan';
  if (status === 'in-development' || status === 'in-review') return 'Build';
  if (status === 'launched' || status === 'completed') return 'Run';
  return 'Plan';
}

export function isProjectDirectAssignee(project: IProject, employeeId: string): boolean {
  const assignedId = (project as { assignedToEmployeeId?: { toString(): string } }).assignedToEmployeeId;
  return assignedId?.toString() === employeeId;
}

function taskMatchesMode(task: IProjectTask, mode: UtilizationBreakdownMode): boolean {
  return mode === 'committed' ? task.status !== 'completed' : task.status === 'completed';
}

export function sumEmployeeTaskHoursInProject(options: {
  project: IProject;
  employee: IEmployee;
  mode: UtilizationBreakdownMode;
  rangeStart: Date;
  rangeEnd: Date;
  calculateHoursInRange: HoursInRangeFn;
  isTaskAssignedToEmployee: (task: IProjectTask, employee: IEmployee) => boolean;
}): number {
  const { project, employee, mode, rangeStart, rangeEnd, calculateHoursInRange, isTaskAssignedToEmployee } =
    options;

  if (!project.tasks?.length) return 0;

  return project.tasks
    .filter(
      (task) =>
        isTaskAssignedToEmployee(task, employee) &&
        task.estimatedHours &&
        taskMatchesMode(task, mode)
    )
    .reduce((sum, task) => {
      if (!task.estimatedHours || !task.startDate || !task.endDate) return sum;
      const taskStart = parseDateSafe(task.startDate);
      const taskEnd = parseDateSafe(task.endDate);
      if (!taskStart || !taskEnd) return sum;
      return sum + calculateHoursInRange(rangeStart, rangeEnd, taskStart, taskEnd, task.estimatedHours);
    }, 0);
}

export function projectFallbackHours(options: {
  project: IProject;
  employee: IEmployee;
  mode: UtilizationBreakdownMode;
  employeeTaskHoursInProject: number;
  isTaskAssignedToOtherEmployee: (task: IProjectTask, employee: IEmployee) => boolean;
}): number {
  const { project, employee, mode, employeeTaskHoursInProject, isTaskAssignedToOtherEmployee } = options;

  if (employeeTaskHoursInProject > 0) return 0;
  if (!isProjectDirectAssignee(project, employee._id.toString())) return 0;
  if (!project.estimatedHours) return 0;

  if (mode === 'committed') {
    if (project.status === 'completed') return 0;
  } else {
    if (project.status !== 'launched' && project.status !== 'completed') return 0;
  }

  let otherEmployeeTaskHours = 0;
  for (const task of project.tasks ?? []) {
    if (!task.estimatedHours || !taskMatchesMode(task, mode)) continue;
    if (isTaskAssignedToOtherEmployee(task, employee)) {
      otherEmployeeTaskHours += task.estimatedHours;
    }
  }

  return Math.max(0, project.estimatedHours - otherEmployeeTaskHours);
}

export function buildStageHoursBreakdown(options: {
  projects: IProject[];
  employee: IEmployee;
  mode: UtilizationBreakdownMode;
  rangeStart: Date;
  rangeEnd: Date;
  calculateHoursInRange: HoursInRangeFn;
  isTaskAssignedToEmployee: (task: IProjectTask, employee: IEmployee) => boolean;
  isTaskAssignedToOtherEmployee: (task: IProjectTask, employee: IEmployee) => boolean;
  contentItems?: IContentItem[];
  projectById?: Map<string, IProject>;
}): StageHoursBreakdown {
  const {
    projects,
    employee,
    mode,
    rangeStart,
    rangeEnd,
    calculateHoursInRange,
    isTaskAssignedToEmployee,
    isTaskAssignedToOtherEmployee,
    contentItems = [],
    projectById,
  } = options;

  const breakdown = emptyStageBreakdown();
  const employeeId = employee._id.toString();

  for (const project of projects) {
    if (mode === 'committed' && project.status === 'completed') continue;

    const stage = getProjectStage(project.status);
    const taskHours = sumEmployeeTaskHoursInProject({
      project,
      employee,
      mode,
      rangeStart,
      rangeEnd,
      calculateHoursInRange,
      isTaskAssignedToEmployee,
    });

    if (taskHours > 0) {
      breakdown[stage] += taskHours;
    }

    const fallback = projectFallbackHours({
      project,
      employee,
      mode,
      employeeTaskHoursInProject: taskHours,
      isTaskAssignedToOtherEmployee,
    });
    if (fallback > 0) {
      breakdown[stage] += fallback;
    }
  }

  for (const item of contentItems) {
    if (item.assignedToEmployeeId?.toString() !== employeeId) continue;
    const hours = item.estimatedHours || 0;
    if (hours <= 0) continue;

    const projectId = item.projectId?.toString();
    let stage: ProjectStage = 'Plan';
    if (projectId && projectById?.has(projectId)) {
      stage = getProjectStage(projectById.get(projectId)!.status);
    } else if (projectId) {
      const linked = projects.find((p) => p._id.toString() === projectId);
      if (linked) stage = getProjectStage(linked.status);
    }

    breakdown[stage] += hours;
  }

  return roundStageBreakdown(breakdown);
}
