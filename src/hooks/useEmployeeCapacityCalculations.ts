import { useCallback, useMemo } from 'react';
import type { IEmployee } from '@/lib/models/Employee';
import type { IProject, IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import type { IMeeting } from '@/lib/models/Meeting';
import { TimeframeType, getTimeframeRange, parseDateSafe, taskOverlapsViewRange } from '@/lib/utils/dateUtils';
import { isTaskAssignedToEmployee, isTaskAssignedToOtherEmployee } from '@/lib/utils/projectTeam';
import { contentCountsInViewPeriod } from '@/lib/utils/projectHours';
import { buildStageHoursBreakdown, sumStageBreakdown } from '@/lib/utils/employeeUtilizationBreakdown';
import { calculateProratedHoursInRange, countWeekdaysInRange } from '@/lib/utils/utilizationTaskHours';
import { sumMeetingHoursForEmployee } from '@/lib/scheduling/meetingHours';

/** Non-completed tasks on `project` assigned to `employee` (by id or legacy name). */
export function getOpenTasksAssignedToEmployee(project: IProject, employee: IEmployee): IProjectTask[] {
  if (!project.tasks) return [];
  return project.tasks.filter(
    (task) => isTaskAssignedToEmployee(task, employee) && task.status !== 'completed'
  );
}

/** Open assigned tasks whose date range overlaps the active view period. */
export function getAssignedTasksInViewPeriod(
  project: IProject,
  employee: IEmployee,
  viewStart: Date,
  viewEnd: Date
): IProjectTask[] {
  return getOpenTasksAssignedToEmployee(project, employee).filter((task) => {
    const taskStart = parseDateSafe(task.startDate);
    const taskEnd = parseDateSafe(task.endDate);
    if (!taskStart || !taskEnd) return false;
    return taskOverlapsViewRange(viewStart, viewEnd, taskStart, taskEnd);
  });
}

export function contentProjectIdStr(item: IContentItem): string {
  const pid = item.projectId as unknown;
  if (typeof pid === 'string') return pid;
  if (pid && typeof (pid as { toString?: () => string }).toString === 'function') {
    return (pid as { toString: () => string }).toString();
  }
  return '';
}

export function getAssignedContentInViewPeriod(
  employee: IEmployee,
  items: IContentItem[] | undefined,
  timeframe: TimeframeType,
  viewStart: Date,
  viewEnd: Date,
  options?: { forCompleted?: boolean }
): IContentItem[] {
  if (!items) return [];
  const employeeId = employee._id.toString();
  return items.filter(
    (c) =>
      c.assignedToEmployeeId?.toString() === employeeId &&
      contentCountsInViewPeriod(c, timeframe, viewStart, viewEnd, options)
  );
}

interface UseEmployeeCapacityCalculationsOptions {
  projects: IProject[];
  allProjects?: IProject[];
  contentItems?: IContentItem[];
  meetings?: IMeeting[];
  timeframe: TimeframeType;
  currentDate: Date;
}

/**
 * Capacity/utilization math for the employee sidebar: available hours, committed hours,
 * meeting hours, completed hours, and per-stage breakdowns. Pure derivations of props,
 * extracted from EmployeeSidebar so the calculation logic is independently reviewable.
 */
export function useEmployeeCapacityCalculations({
  projects,
  allProjects,
  contentItems,
  meetings = [],
  timeframe,
  currentDate,
}: UseEmployeeCapacityCalculationsOptions) {
  const calcProjects = allProjects || projects;

  const range = getTimeframeRange(timeframe, currentDate);
  const startDate = new Date(range.start);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(range.end);
  endDate.setHours(23, 59, 59, 999);

  const totalAvailableHours = useCallback(
    (employee: IEmployee) => {
      if (timeframe === 'today') {
        // Same daily capacity on weekends so scheduled work can show utilization
        return Math.round((employee.weeklyHours / 5) * 100) / 100;
      }
      if (timeframe === 'weekly') {
        // Weekly is exactly 1 week = 5 weekdays
        return employee.weeklyHours;
      }
      // For other timeframes, count weekdays in the range
      const weekdays = countWeekdaysInRange(startDate, endDate);
      const weeks = weekdays / 5;
      const hours = employee.weeklyHours * weeks;
      return Math.round(hours * 100) / 100;
    },
    [timeframe, startDate, endDate]
  );

  const getProjectsForEmployee = useCallback(
    (employee: IEmployee) => {
      return calcProjects.filter((project) => {
        const employeeIdStr = employee._id.toString();

        const projectAssignedToIds = project.assignedToEmployeeIds;
        if (projectAssignedToIds && Array.isArray(projectAssignedToIds)) {
          if (projectAssignedToIds.some((id) => id?.toString() === employeeIdStr)) {
            return true;
          }
        }

        const projectAssignedToNames = project.assignedToNames;
        if (projectAssignedToNames && Array.isArray(projectAssignedToNames)) {
          if (projectAssignedToNames.includes(employee.name)) {
            return true;
          }
        }

        const projectAssignedToId = project.assignedToEmployeeId?.toString();
        if (projectAssignedToId === employeeIdStr) {
          return true;
        }

        if (project.assignedTo && project.assignedTo === employee.name) {
          return true;
        }

        if (project.tasks?.some((task) => isTaskAssignedToEmployee(task, employee))) {
          return true;
        }

        return false;
      });
    },
    [calcProjects]
  );

  const calculateHoursForDateRange = useCallback(
    (rangeStart: Date, rangeEnd: Date, projectStart: Date, projectEnd: Date, totalHours: number): number => {
      const taskStart = parseDateSafe(projectStart);
      const taskEnd = parseDateSafe(projectEnd);
      if (!taskStart || !taskEnd) return 0;
      return calculateProratedHoursInRange(rangeStart, rangeEnd, taskStart, taskEnd, totalHours);
    },
    []
  );

  const sumAssignedTaskHoursInPeriod = useCallback(
    (employee: IEmployee) => {
      let total = 0;
      getProjectsForEmployee(employee).forEach((project) => {
        getAssignedTasksInViewPeriod(project, employee, startDate, endDate).forEach((task) => {
          if (!task.estimatedHours || !task.startDate || !task.endDate) return;
          const taskStart = parseDateSafe(task.startDate);
          const taskEnd = parseDateSafe(task.endDate);
          if (!taskStart || !taskEnd) return;
          total += calculateHoursForDateRange(startDate, endDate, taskStart, taskEnd, task.estimatedHours);
        });
      });
      return Math.round(total * 100) / 100;
    },
    [getProjectsForEmployee, calculateHoursForDateRange, startDate, endDate]
  );

  const sumAssignedContentHoursInPeriod = useCallback(
    (employee: IEmployee) => {
      const hours = getAssignedContentInViewPeriod(employee, contentItems, timeframe, startDate, endDate).reduce(
        (sum, c) => sum + (c.estimatedHours || 0),
        0
      );
      return Math.round(hours * 100) / 100;
    },
    [contentItems, timeframe, startDate, endDate]
  );

  const getCommittedHours = useCallback(
    (employee: IEmployee) => {
      const employeeProjects = getProjectsForEmployee(employee);
      let totalHours = 0;

      // NOTE: Completed projects are excluded from committed hours so that marking
      // items as complete frees up employee capacity. Projects no longer have their
      // own start/end dates - only tasks do.
      employeeProjects.forEach((project) => {
        if (project.status === 'completed') return;

        let hasEmployeeTasks = false;
        let taskHoursInRange = 0;
        if (project.tasks && project.tasks.length > 0) {
          taskHoursInRange = project.tasks
            .filter(
              (task) =>
                isTaskAssignedToEmployee(task, employee) &&
                task.estimatedHours &&
                task.status !== 'completed'
            )
            .reduce((sum, task) => {
              hasEmployeeTasks = true;
              if (!task.estimatedHours || !task.startDate || !task.endDate) return sum;
              const taskStart = parseDateSafe(task.startDate);
              const taskEnd = parseDateSafe(task.endDate);
              if (!taskStart || !taskEnd) return sum;
              const hours = calculateHoursForDateRange(startDate, endDate, taskStart, taskEnd, task.estimatedHours);
              return sum + hours;
            }, 0);
          totalHours += taskHoursInRange;
        }

        // If project is assigned to this employee AND there are no tasks assigned to this
        // employee, count project-level hours (not date-distributed since projects don't
        // have dates anymore).
        const projectAssignedToId = project.assignedToEmployeeId?.toString();
        const isProjectAssignedToEmployee = projectAssignedToId === employee._id.toString();
        if (isProjectAssignedToEmployee && project.estimatedHours && !hasEmployeeTasks) {
          let otherEmployeeTaskHours = 0;
          if (project.tasks && project.tasks.length > 0) {
            project.tasks.forEach((task) => {
              if (
                task.estimatedHours &&
                task.status !== 'completed' &&
                isTaskAssignedToOtherEmployee(task, employee)
              ) {
                otherEmployeeTaskHours += task.estimatedHours;
              }
            });
          }
          const remainingProjectHours = Math.max(0, project.estimatedHours - otherEmployeeTaskHours);
          totalHours += remainingProjectHours;
        }
      });

      getAssignedContentInViewPeriod(employee, contentItems, timeframe, startDate, endDate).forEach((content) => {
        const hours = content.estimatedHours || 0;
        if (hours > 0) totalHours += hours;
      });

      if (meetings.length > 0) {
        totalHours += sumMeetingHoursForEmployee(meetings, employee, startDate, endDate);
      }

      return Math.round(totalHours * 100) / 100;
    },
    [getProjectsForEmployee, calculateHoursForDateRange, startDate, endDate, contentItems, timeframe, meetings]
  );

  const getMeetingHours = useCallback(
    (employee: IEmployee) => {
      if (meetings.length === 0) return 0;
      return sumMeetingHoursForEmployee(meetings, employee, startDate, endDate);
    },
    [meetings, startDate, endDate]
  );

  const projectById = useMemo(() => {
    const map = new Map<string, IProject>();
    calcProjects.forEach((p) => map.set(p._id.toString(), p));
    return map;
  }, [calcProjects]);

  const buildBreakdownForEmployee = useCallback(
    (employee: IEmployee, mode: 'committed' | 'completed') => {
      const contentInPeriod = getAssignedContentInViewPeriod(
        employee,
        contentItems,
        timeframe,
        startDate,
        endDate,
        mode === 'completed' ? { forCompleted: true } : undefined
      );

      return buildStageHoursBreakdown({
        projects: getProjectsForEmployee(employee),
        employee,
        mode,
        rangeStart: startDate,
        rangeEnd: endDate,
        calculateHoursInRange: calculateHoursForDateRange,
        isTaskAssignedToEmployee,
        isTaskAssignedToOtherEmployee,
        contentItems: contentInPeriod,
        projectById,
      });
    },
    [contentItems, timeframe, startDate, endDate, getProjectsForEmployee, calculateHoursForDateRange, projectById]
  );

  const getCommittedHoursBreakdown = useCallback(
    (employee: IEmployee) => buildBreakdownForEmployee(employee, 'committed'),
    [buildBreakdownForEmployee]
  );

  const getCompletedHoursBreakdown = useCallback(
    (employee: IEmployee) => buildBreakdownForEmployee(employee, 'completed'),
    [buildBreakdownForEmployee]
  );

  const getCompletedHours = useCallback(
    (employee: IEmployee) => sumStageBreakdown(getCompletedHoursBreakdown(employee)),
    [getCompletedHoursBreakdown]
  );

  return {
    calcProjects,
    startDate,
    endDate,
    getProjectsForEmployee,
    calculateHoursForDateRange,
    totalAvailableHours,
    sumAssignedTaskHoursInPeriod,
    sumAssignedContentHoursInPeriod,
    getCommittedHours,
    getMeetingHours,
    getCommittedHoursBreakdown,
    getCompletedHoursBreakdown,
    getCompletedHours,
  };
}
