'use client';

import { useMemo, useState, useCallback } from 'react';
import { IEmployee } from '@/lib/models/Employee';
import { IProject, IProjectTask } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import {
  TimeframeType,
  getTimeframeRange,
  formatDate,
  parseDateSafe,
  taskOverlapsViewRange,
  taskOverlapsViewDay,
} from '@/lib/utils/dateUtils';
import {
  isTaskAssignedToEmployee,
  isTaskAssignedToOtherEmployee,
} from '@/lib/utils/projectTeam';
import { contentCountsInViewPeriod } from '@/lib/utils/projectHours';
import Card from '@/components/ui/Card';

/** Format hours for utilization cards (one decimal on Today). */
function formatUtilizationHours(hours: number, timeframe: TimeframeType): string {
  if (timeframe === 'today') {
    const rounded = Math.round(hours * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }
  return String(Math.round(hours));
}

function isWeekendUtc(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

interface EmployeeSidebarProps {
  employees: IEmployee[];
  projects: IProject[]; // Filtered projects for display (by page stage)
  allProjects?: IProject[]; // All projects for calculations (across all stages)
  contentItems?: IContentItem[]; // Content items for calculations
  timeframe: TimeframeType;
  currentDate: Date;
  currentUserRole?: 'Administrator' | 'Manager' | 'User';
  currentUserEmployeeId?: string | null;
}

/** Non-completed tasks on `project` assigned to `employee` (by id or legacy name). */
function getOpenTasksAssignedToEmployee(project: IProject, employee: IEmployee): IProjectTask[] {
  if (!project.tasks) return [];
  return project.tasks.filter(
    (task) => isTaskAssignedToEmployee(task, employee) && task.status !== 'completed'
  );
}

/** Open assigned tasks whose date range overlaps the active view period. */
function getAssignedTasksInViewPeriod(
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

function contentProjectIdStr(item: IContentItem): string {
  const pid = item.projectId as unknown;
  if (typeof pid === 'string') return pid;
  if (pid && typeof (pid as { toString?: () => string }).toString === 'function') {
    return (pid as { toString: () => string }).toString();
  }
  return '';
}

function getAssignedContentInViewPeriod(
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

export default function EmployeeSidebar({ employees, projects, allProjects, contentItems, timeframe, currentDate, currentUserRole, currentUserEmployeeId }: EmployeeSidebarProps) {
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Set<string>>(new Set()); // Track which breakdowns are expanded (e.g., "employeeId-committed")

  // Use allProjects for calculations, fallback to filtered projects if not provided
  const calcProjects = allProjects || projects;

  const range = getTimeframeRange(timeframe, currentDate);

  const toggleEmployee = useCallback((employeeId: string) => {
    setExpandedEmployees(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  }, []);
  // Normalize start date to beginning of day, end date to end of day for accurate calculations
  const startDate = new Date(range.start);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(range.end);
  // Keep end date at end of day (23:59:59.999) to include the full day
  endDate.setHours(23, 59, 59, 999);

  // Helper function to count weekdays (Monday-Friday) between two dates
  const countWeekdays = (start: Date, end: Date): number => {
    let count = 0;
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      // 0 = Sunday, 6 = Saturday, so weekdays are 1-5 (Monday-Friday)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  };

  // Calculate total available hours based on timeframe (weekdays only)
  const totalAvailableHours = (employee: IEmployee) => {
    if (timeframe === 'today') {
      // Same daily capacity on weekends so scheduled work can show utilization
      return Math.round((employee.weeklyHours / 5) * 100) / 100;
    }
    if (timeframe === 'weekly') {
      // Weekly is exactly 1 week = 5 weekdays
      return employee.weeklyHours;
    }

    // For other timeframes, count weekdays in the range
    const weekdays = countWeekdays(startDate, endDate);
    const weeks = weekdays / 5;
    const hours = employee.weeklyHours * weeks;
    return Math.round(hours * 100) / 100; // Round to 2 decimals
  };

  // Helper function to get projects for an employee (filtered by current timeframe and assignments)
  const getProjectsForEmployeeCalc = useCallback((employee: IEmployee) => {
    return calcProjects.filter((project) => {
      const employeeIdStr = employee._id.toString();

      // Check if project is assigned to this employee by multiple IDs array (new preferred method)
      const projectAssignedToIds = (project as any).assignedToEmployeeIds;
      if (projectAssignedToIds && Array.isArray(projectAssignedToIds)) {
        if (projectAssignedToIds.some((id: any) => id?.toString() === employeeIdStr)) {
          return true;
        }
      }

      // Check if project is assigned to this employee by multiple names array
      const projectAssignedToNames = (project as any).assignedToNames;
      if (projectAssignedToNames && Array.isArray(projectAssignedToNames)) {
        if (projectAssignedToNames.includes(employee.name)) {
          return true;
        }
      }

      // Check if project is assigned to this employee by single ID (legacy)
      const projectAssignedToId = (project as any).assignedToEmployeeId?.toString();
      if (projectAssignedToId === employeeIdStr) {
        return true;
      }

      // Check if project is assigned by legacy name field
      if (project.assignedTo && project.assignedTo === employee.name) {
        return true;
      }

      if (project.tasks?.some((task) => isTaskAssignedToEmployee(task, employee))) {
        return true;
      }

      return false;
    });
  }, [calcProjects]);

  // Alias for display components
  const getProjectsForEmployee = getProjectsForEmployeeCalc;



  // Helper function to normalize date to start of day
  const normalizeToStartOfDay = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  // Helper function to normalize date to end of day
  const normalizeToEndOfDay = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(23, 59, 59, 999);
    return normalized;
  };

  // Helper function to calculate hours for a date range (weekdays only; full hours on Today overlap)
  const calculateHoursForDateRange = (
    rangeStart: Date,
    rangeEnd: Date,
    projectStart: Date,
    projectEnd: Date,
    totalHours: number
  ): number => {
    if (timeframe === 'today') {
      const taskStart = parseDateSafe(projectStart);
      const taskEnd = parseDateSafe(projectEnd);
      if (!taskStart || !taskEnd) return 0;
      if (taskOverlapsViewRange(rangeStart, rangeEnd, taskStart, taskEnd)) {
        return totalHours;
      }
      return 0;
    }

    // Normalize project dates: start to beginning of day, end to end of day (inclusive)
    // Note: HTML date inputs store dates as YYYY-MM-DD 00:00:00, so endDate at Day 10 means Day 10 00:00:00
    // We need to treat this as inclusive of Day 10, so normalize to end of Day 10
    const normalizedProjectStart = normalizeToStartOfDay(projectStart);
    const normalizedProjectEnd = normalizeToEndOfDay(projectEnd);

    // Normalize range dates: start to beginning of day, end to end of day
    const normalizedRangeStart = normalizeToStartOfDay(rangeStart);
    const normalizedRangeEnd = normalizeToEndOfDay(rangeEnd);

    // Find the overlap between project dates and the timeframe
    // Compare dates properly: if project starts after range ends or project ends before range starts, no overlap
    if (normalizedProjectStart.getTime() > normalizedRangeEnd.getTime() ||
      normalizedProjectEnd.getTime() < normalizedRangeStart.getTime()) {
      return 0;
    }

    const overlapStart = normalizedProjectStart > normalizedRangeStart ? normalizedProjectStart : normalizedRangeStart;
    const overlapEnd = normalizedProjectEnd < normalizedRangeEnd ? normalizedProjectEnd : normalizedRangeEnd;

    // If no overlap, return 0
    if (overlapStart.getTime() > overlapEnd.getTime()) return 0;

    // Calculate project duration in weekdays (Monday-Friday only)
    const projectDurationWeekdays = countWeekdays(normalizedProjectStart, normalizedProjectEnd);

    if (projectDurationWeekdays <= 0) return 0;

    // Calculate number of weekdays in the overlap
    const overlapWeekdays = countWeekdays(overlapStart, overlapEnd);

    // Ensure we have at least 1 weekday
    if (overlapWeekdays < 1) return 0;

    // Calculate hours for the overlap period (weekdays only)
    // Use precise calculation to avoid floating point errors
    const hoursForOverlap = (totalHours * overlapWeekdays) / projectDurationWeekdays;

    return hoursForOverlap;
  };

  const getCommittedHours = (employee: IEmployee) => {
    const employeeProjects = getProjectsForEmployeeCalc(employee);
    let totalHours = 0;

    // Calculate hours from projects
    // NOTE: Completed projects are excluded from committed hours
    // This ensures that marking items as complete frees up employee capacity
    // NOTE: Projects no longer have startDate/endDate - only tasks do
    employeeProjects.forEach((project) => {
      // Skip completed projects - they don't count toward committed hours
      if (project.status === 'completed') return;

      // Calculate task hours assigned to this employee (count independently of project hours)
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
            const hours = calculateHoursForDateRange(
              startDate,
              endDate,
              taskStart,
              taskEnd,
              task.estimatedHours
            );
            return sum + hours;
          }, 0);
        totalHours += taskHoursInRange;
      }

      // If project is assigned to this employee AND there are no tasks assigned to this employee,
      // count project-level hours (not date-distributed since projects don't have dates anymore)
      const projectAssignedToId = (project as any).assignedToEmployeeId?.toString();
      const isProjectAssignedToEmployee = projectAssignedToId === employee._id.toString();
      if (isProjectAssignedToEmployee && project.estimatedHours && !hasEmployeeTasks) {
        // Calculate total hours assigned to other employees via tasks
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

        // Project hours minus tasks assigned to others
        // Since projects don't have dates, we add full remaining hours to committed
        const remainingProjectHours = Math.max(0, project.estimatedHours - otherEmployeeTaskHours);
        totalHours += remainingProjectHours;
      }
    });



    getAssignedContentInViewPeriod(employee, contentItems, timeframe, startDate, endDate).forEach((content) => {
      const hours = content.estimatedHours || 0;
      if (hours > 0) totalHours += hours;
    });

    // Round to 2 decimal places for display
    return Math.round(totalHours * 100) / 100;
  };

  // Helper function to get project stage from status
  const getProjectStage = (status: string): 'Plan' | 'Build' | 'Run' => {
    if (status === 'planning') return 'Plan';
    if (status === 'in-development' || status === 'in-review') return 'Build';
    if (status === 'launched' || status === 'completed') return 'Run';
    return 'Plan'; // default
  };

  const getCommittedHoursBreakdown = (employee: IEmployee) => {
    const breakdown = { Plan: 0, Build: 0, Run: 0 };
    const employeeProjects = getProjectsForEmployeeCalc(employee);

    employeeProjects.forEach((project) => {
      if (project.status === 'completed') return;
      const stage = getProjectStage(project.status);

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
            if (!task.estimatedHours || !task.startDate || !task.endDate) return sum;
            const taskStart = parseDateSafe(task.startDate);
            const taskEnd = parseDateSafe(task.endDate);
            if (!taskStart || !taskEnd) return sum;
            return sum + calculateHoursForDateRange(startDate, endDate, taskStart, taskEnd, task.estimatedHours);
          }, 0);
        breakdown[stage] += taskHoursInRange;
      }

      const projectAssignedToId = (project as any).assignedToEmployeeId?.toString();
      const isProjectAssignedToEmployee = projectAssignedToId === employee._id.toString();

      if (isProjectAssignedToEmployee && project.estimatedHours && !taskHoursInRange) {
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
        breakdown[stage] += remainingProjectHours;
      }
    });

    getAssignedContentInViewPeriod(employee, contentItems, timeframe, startDate, endDate).forEach((content) => {
      const hours = content.estimatedHours || 0;
      if (hours <= 0) return;
      const stage = content.projectId
        ? getProjectStage(
            calcProjects.find((p) => p._id.toString() === contentProjectIdStr(content))?.status || 'planning'
          )
        : 'Plan';
      breakdown[stage] += hours;
    });

    return {
      Plan: Math.round(breakdown.Plan * 100) / 100,
      Build: Math.round(breakdown.Build * 100) / 100,
      Run: Math.round(breakdown.Run * 100) / 100,
    };
  };

  // Calculate breakdown by stage for completed hours
  const getCompletedHoursBreakdown = (employee: IEmployee) => {
    const breakdown = { Plan: 0, Build: 0, Run: 0 };
    const employeeProjects = getProjectsForEmployeeCalc(employee);

    employeeProjects.forEach((project) => {
      if (project.status !== 'launched' && project.status !== 'completed') return;
      const stage = getProjectStage(project.status);

      if (project.tasks && project.tasks.length > 0) {
        const taskHoursInRange = project.tasks
          .filter(
            (task) =>
              isTaskAssignedToEmployee(task, employee) &&
              task.estimatedHours &&
              task.status === 'completed'
          )
          .reduce((sum, task) => {
            if (!task.estimatedHours || !task.startDate || !task.endDate) return sum;
            const taskStart = parseDateSafe(task.startDate);
            const taskEnd = parseDateSafe(task.endDate);
            if (!taskStart || !taskEnd) return sum;
            return sum + calculateHoursForDateRange(startDate, endDate, taskStart, taskEnd, task.estimatedHours);
          }, 0);
        breakdown[stage] += taskHoursInRange;
      }

      const projectAssignedToId = (project as any).assignedToEmployeeId?.toString();
      if (projectAssignedToId === employee._id.toString() && project.estimatedHours) {
        let otherEmployeeTaskHours = 0;
        if (project.tasks && project.tasks.length > 0) {
          project.tasks.forEach((task) => {
            if (
              task.estimatedHours &&
              task.status === 'completed' &&
              isTaskAssignedToOtherEmployee(task, employee)
            ) {
              otherEmployeeTaskHours += task.estimatedHours;
            }
          });
        }
        const remainingProjectHours = Math.max(0, project.estimatedHours - otherEmployeeTaskHours);
        breakdown[stage] += remainingProjectHours;
      }
    });



    return {
      Plan: Math.round(breakdown.Plan * 100) / 100,
      Build: Math.round(breakdown.Build * 100) / 100,
      Run: Math.round(breakdown.Run * 100) / 100,
    };
  };

  // Calculate breakdown by stage for remaining hours
  const getRemainingHoursBreakdown = (employee: IEmployee) => {
    const committedBreakdown = getCommittedHoursBreakdown(employee);
    const available = totalAvailableHours(employee);

    // Calculate remaining per stage (available - committed per stage)
    // Remaining shows how much capacity is left after accounting for committed hours in each stage
    return {
      Plan: Math.round(Math.max(0, available - committedBreakdown.Plan) * 100) / 100,
      Build: Math.round(Math.max(0, available - committedBreakdown.Build) * 100) / 100,
      Run: Math.round(Math.max(0, available - committedBreakdown.Run) * 100) / 100,
    };
  };

  const getAvailableHours = (employee: IEmployee) => {
    const available = totalAvailableHours(employee);
    const committed = getCommittedHours(employee);
    return Math.round(Math.max(0, available - committed) * 100) / 100; // Round to 2 decimals
  };

  // Calculate completed hours for an employee (only items with status 'complete' or 'completed')
  const getCompletedHours = (employee: IEmployee) => {
    const employeeProjects = getProjectsForEmployeeCalc(employee);
    let totalHours = 0;

    // Calculate hours from completed projects
    // NOTE: Projects no longer have startDate/endDate - only tasks and operations do
    employeeProjects.forEach((project) => {
      // Only count completed projects
      if (project.status !== 'launched' && project.status !== 'completed') return;

      // Calculate total task hours assigned to this employee (completed tasks only)
      let employeeTaskHours = 0;
      if (project.tasks && project.tasks.length > 0) {
        project.tasks.forEach((task) => {
          if (
            isTaskAssignedToEmployee(task, employee) &&
            task.estimatedHours &&
            task.status === 'completed'
          ) {
            employeeTaskHours += task.estimatedHours;
          }
        });
      }

      // If employee has completed tasks assigned, count those task hours
      if (employeeTaskHours > 0 && project.tasks) {
        const taskHoursInRange = project.tasks
          .filter(
            (task) =>
              isTaskAssignedToEmployee(task, employee) &&
              task.estimatedHours &&
              task.status === 'completed'
          )
          .reduce((sum, task) => {
            if (!task.estimatedHours || !task.startDate || !task.endDate) return sum;
            const taskStart = parseDateSafe(task.startDate);
            const taskEnd = parseDateSafe(task.endDate);
            if (!taskStart || !taskEnd) return sum;
            return sum + calculateHoursForDateRange(
              startDate,
              endDate,
              taskStart,
              taskEnd,
              task.estimatedHours
            );
          }, 0);
        totalHours += taskHoursInRange;
      }

      // If project is assigned to this employee and completed, count remaining hours
      const projectAssignedToId = (project as any).assignedToEmployeeId?.toString();
      if (projectAssignedToId === employee._id.toString() && project.estimatedHours) {
        // Calculate total hours assigned to other employees via completed tasks
        let otherEmployeeTaskHours = 0;
        if (project.tasks && project.tasks.length > 0) {
          project.tasks.forEach((task) => {
            if (
              task.estimatedHours &&
              task.status === 'completed' &&
              isTaskAssignedToOtherEmployee(task, employee)
            ) {
              otherEmployeeTaskHours += task.estimatedHours;
            }
          });
        }

        // Project hours minus tasks assigned to others
        // Since projects don't have dates, add full remaining hours
        const remainingProjectHours = Math.max(0, project.estimatedHours - otherEmployeeTaskHours);
        totalHours += remainingProjectHours;
      }
    });



    getAssignedContentInViewPeriod(employee, contentItems, timeframe, startDate, endDate, {
      forCompleted: true,
    }).forEach((content) => {
      const hours = content.estimatedHours || 0;
      if (hours > 0) totalHours += hours;
    });

    return Math.round(totalHours * 100) / 100;
  };

  if (employees.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted">
        <p className="mb-2">No employees added yet</p>
        <p className="text-sm">Add employees to track their workload</p>
      </div>
    );
  }

  // Filter employees based on role - memoized to recalculate when role or employee list changes
  const visibleEmployees = useMemo(() => {
    // Filter to only employees with userId (registered users)
    const employeesWithUserId = employees.filter(employee => employee.userId != null);

    // If role is not set yet, show all employees with userId (safer default)
    if (!currentUserRole) {
      return employeesWithUserId;
    }

    // Role-based filtering:
    // - Administrators: see all employees
    // - Managers: see all employees (users, managers, and admins)
    // - Users: see only themselves
    if (currentUserRole === 'User') {
      if (!currentUserEmployeeId) {
        return [];
      }
      return employeesWithUserId.filter(employee => {
        const employeeId = employee._id.toString();
        return employeeId === currentUserEmployeeId;
      });
    }

    // Managers and Administrators see all employees
    if (currentUserRole === 'Manager' || currentUserRole === 'Administrator') {
      return employeesWithUserId;
    }

    // Fallback: if role is something unexpected, show all
    return employeesWithUserId;
  }, [employees, currentUserRole, currentUserEmployeeId]);

  // Sort employees so current user's card appears first
  const sortedVisibleEmployees = useMemo(() => {
    if (!currentUserEmployeeId) return visibleEmployees;

    const sorted = [...visibleEmployees];
    const currentUserIndex = sorted.findIndex(emp => emp._id.toString() === currentUserEmployeeId);

    if (currentUserIndex > 0) {
      // Move current user to the top
      const [currentUser] = sorted.splice(currentUserIndex, 1);
      sorted.unshift(currentUser);
    }

    return sorted;
  }, [visibleEmployees, currentUserEmployeeId]);

  // Calculate team totals - only include visible employees (based on role)
  const teamTotals = sortedVisibleEmployees.reduce((totals, employee) => {
    const committedHours = getCommittedHours(employee);
    const completedHours = getCompletedHours(employee);
    const availableHoursForDisplay = totalAvailableHours(employee);
    const totalCap = totalAvailableHours(employee);

    return {
      committed: totals.committed + committedHours,
      completed: totals.completed + completedHours,
      available: totals.available + (totalCap - committedHours),
      total: totals.total + totalCap
    };
  }, { committed: 0, completed: 0, available: 0, total: 0 });

  const teamUtilizationPercent = teamTotals.total > 0
    ? Math.round((teamTotals.committed / teamTotals.total) * 100)
    : 0;

  const utilizationCardSurface = 'p-4 bg-background-elevated border-border';

  return (
    <div className="space-y-4">
      {/* Team Overview Card */}
      <Card className={utilizationCardSurface}>
        <h3 className="font-bold text-text-primary mb-3 flex items-center justify-between text-sm uppercase tracking-wider">
          <span>Team Workload Overview</span>
          <span className="text-text-muted font-normal">({timeframe.charAt(0).toUpperCase() + timeframe.slice(1)})</span>
        </h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-background-card p-3 rounded-lg border border-border shadow-sm">
            <p className="text-xs text-text-secondary mb-1">Total Available Capacity</p>
            <p className="text-lg font-bold text-text-primary">{formatUtilizationHours(teamTotals.total, timeframe)}h</p>
          </div>
          <div className="bg-background-card p-3 rounded-lg border border-border shadow-sm">
            <p className="text-xs text-text-secondary mb-1">Overall Utilization</p>
            <p className={`text-lg font-bold ${teamUtilizationPercent > 100 ? 'text-red-500' : teamUtilizationPercent > 80 ? 'text-orange-500' : 'text-green-500'}`}>
              {teamUtilizationPercent}%
            </p>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-text-secondary mb-1">
            <div className="flex gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                Committed: {formatUtilizationHours(teamTotals.committed, timeframe)}h
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Completed: {Math.round(teamTotals.completed)}h
              </span>
            </div>
            <span>Remaining: {Math.max(0, Math.round(teamTotals.total - teamTotals.committed))}h</span>
          </div>
          <div className="w-full bg-border rounded-full h-2 flex overflow-hidden">
            <div
              className={`h-2 ${teamUtilizationPercent > 100 ? 'bg-red-500' : teamUtilizationPercent > 80 ? 'bg-orange-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(teamUtilizationPercent, 100)}%` }}
            />
          </div>
        </div>
      </Card>

      {sortedVisibleEmployees.map((employee) => {
        const employeeId = employee._id.toString();
        const isExpanded = expandedEmployees.has(employeeId);
        const committedHours = getCommittedHours(employee);
        const completedHours = getCompletedHours(employee);
        const totalHours = totalAvailableHours(employee);
        const employeeProjects = getProjectsForEmployee(employee);
        const assignedContentInPeriod = getAssignedContentInViewPeriod(
          employee,
          contentItems,
          timeframe,
          startDate,
          endDate
        );
        const contentProjectIds = new Set(assignedContentInPeriod.map((c) => contentProjectIdStr(c)));
        const utilizationProjects = [
          ...new Map(
            [
              ...employeeProjects.filter(
                (p) => getAssignedTasksInViewPeriod(p, employee, startDate, endDate).length > 0
              ),
              ...calcProjects.filter((p) => contentProjectIds.has(p._id.toString())),
            ].map((p) => [p._id.toString(), p])
          ).values(),
        ];

        const utilizationPercent = totalHours > 0 ? Math.round((committedHours / totalHours) * 100) : 0;

        const committedHoursDisplay = formatUtilizationHours(committedHours, timeframe);
        const totalHoursDisplay = formatUtilizationHours(totalHours, timeframe);
        const showWeekendLabel = timeframe === 'today' && isWeekendUtc(currentDate);

        return (
          <Card key={employeeId} className={utilizationCardSurface}>
            {/* Header - Always visible */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 flex-1">
                  <button
                    onClick={() => toggleEmployee(employeeId)}
                    className="flex items-center gap-2 flex-1 text-left hover:opacity-80 transition-opacity"
                  >
                    <svg
                      className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <h4 className="font-semibold text-text-primary">{employee.name}</h4>
                  </button>
                  <span className={`text-xs px-1.5 py-0.5 rounded border border-border ${employee.role === 'Administrator' ? 'bg-warning-light text-warning-dark' :
                    employee.role === 'Manager' ? 'bg-secondary-light text-secondary-dark' :
                      'bg-background-card text-text-secondary'
                    }`}>
                    {employee.role}
                  </span>
                </div>
              </div>

              {/* Utilization (hours for selected period) - Always visible */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-text-secondary mb-1">
                  <span>
                    Utilization (this period)
                    {showWeekendLabel ? (
                      <span className="text-text-muted ml-1">(Weekend)</span>
                    ) : null}
                  </span>
                  <span>
                    {committedHoursDisplay}h / {totalHoursDisplay}h
                    {totalHours > 0 ? ` (${utilizationPercent}%)` : ''}
                  </span>
                </div>
                <div className="w-full bg-border rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${utilizationPercent > 100 ? 'bg-red-500' :
                      utilizationPercent > 80 ? 'bg-orange-500' :
                        'bg-green-500'
                      }`}
                    style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
              <>
                {employee.jobTitle && (
                  <p className="text-sm text-text-secondary mb-2">{employee.jobTitle}</p>
                )}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded border border-border ${employee.employeeType === 'full-time' ? 'bg-secondary-light text-secondary-dark' :
                    employee.employeeType === 'part-time' ? 'bg-success-light text-success-dark' :
                      'bg-accent-light text-accent-dark'
                    }`}>
                    {employee.employeeType === 'full-time' ? 'Full-Time' :
                      employee.employeeType === 'part-time' ? 'Part-Time' : 'Contractor'}
                  </span>
                  {(() => {
                    const committedBreakdown = getCommittedHoursBreakdown(employee);
                    const hasPlan = committedBreakdown.Plan > 0;
                    const hasBuild = committedBreakdown.Build > 0;
                    const hasRun = committedBreakdown.Run > 0;

                    if (!hasPlan && !hasBuild && !hasRun) return null;

                    return (
                      <div className="flex items-center gap-1.5 text-xs">
                        {hasPlan && (
                          <span className="px-1.5 py-0.5 rounded bg-primary-light text-primary border border-border" title={`Plan: ${committedBreakdown.Plan}h`}>
                            📋 {committedBreakdown.Plan}h
                          </span>
                        )}
                        {hasBuild && (
                          <span className="px-1.5 py-0.5 rounded bg-warning-light text-warning border border-border" title={`Build: ${committedBreakdown.Build}h`}>
                            🔨 {committedBreakdown.Build}h
                          </span>
                        )}
                        {hasRun && (
                          <span className="px-1.5 py-0.5 rounded bg-success-light text-success border border-border" title={`Run: ${committedBreakdown.Run}h`}>
                            🚀 {committedBreakdown.Run}h
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Available:</span>
                    <span className="font-medium text-text-primary">{totalHours}h</span>
                  </div>
                  <div className="text-sm">
                    <button
                      onClick={() => {
                        const key = `${employeeId}-committed`;
                        setExpandedBreakdowns(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(key)) {
                            newSet.delete(key);
                          } else {
                            newSet.add(key);
                          }
                          return newSet;
                        });
                      }}
                      className="flex justify-between items-center w-full text-left hover:opacity-80 transition-opacity group"
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-text-muted text-sm">{expandedBreakdowns.has(`${employeeId}-committed`) ? '▼' : '▶'}</span>
                        <span className="text-text-secondary">Committed:</span>
                        <span className="text-xs text-text-muted group-hover:text-text-secondary transition-colors">(click to expand)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-warning">{committedHoursDisplay}h</span>
                      </div>
                    </button>
                    {expandedBreakdowns.has(`${employeeId}-committed`) && (() => {
                      const breakdown = getCommittedHoursBreakdown(employee);
                      return (
                        <div className="ml-4 mt-1 space-y-1 text-xs text-text-muted">
                          <div className="flex justify-between">
                            <span>Plan:</span>
                            <span>{breakdown.Plan}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Build:</span>
                            <span>{breakdown.Build}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Run:</span>
                            <span>{breakdown.Run}h</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="text-sm">
                    <button
                      onClick={() => {
                        const key = `${employeeId}-completed`;
                        setExpandedBreakdowns(prev => {
                          const newSet = new Set(prev);
                          if (newSet.has(key)) {
                            newSet.delete(key);
                          } else {
                            newSet.add(key);
                          }
                          return newSet;
                        });
                      }}
                      className="flex justify-between items-center w-full text-left hover:opacity-80 transition-opacity group"
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-text-muted text-sm">{expandedBreakdowns.has(`${employeeId}-completed`) ? '▼' : '▶'}</span>
                        <span className="text-text-secondary">Completed:</span>
                        <span className="text-xs text-text-muted group-hover:text-text-secondary transition-colors">(click to expand)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-success">{Math.round(completedHours)}h</span>
                      </div>
                    </button>
                    {expandedBreakdowns.has(`${employeeId}-completed`) && (() => {
                      const breakdown = getCompletedHoursBreakdown(employee);
                      return (
                        <div className="ml-4 mt-1 space-y-1 text-xs text-text-muted">
                          <div className="flex justify-between">
                            <span>Plan:</span>
                            <span>{breakdown.Plan}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Build:</span>
                            <span>{breakdown.Build}h</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Run:</span>
                            <span>{breakdown.Run}h</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-secondary">Remaining:</span>
                    <span className={`font-medium ${totalHours - committedHours > 0 ? 'text-success' : 'text-error'}`}>
                      {Math.round((totalHours - committedHours) * 100) / 100}h
                    </span>
                  </div>
                </div>

                {/* Projects where this employee has assigned work in the period */}
                {utilizationProjects.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs font-medium text-text-secondary mb-2">Work assigned to you:</p>
                    <div className="space-y-1 max-h-[300px] overflow-y-auto">
                      {utilizationProjects.map((project) => {
                        const projectId = project._id.toString();
                        const assignedTasks = getAssignedTasksInViewPeriod(
                          project,
                          employee,
                          startDate,
                          endDate
                        );

                        const taskHoursList = assignedTasks.map(task => {
                          if (!task.estimatedHours || !task.startDate || !task.endDate) return null;
                          const taskStart = parseDateSafe(task.startDate);
                          const taskEnd = parseDateSafe(task.endDate);
                          if (!taskStart || !taskEnd) return null;

                          const hours = calculateHoursForDateRange(
                            startDate,
                            endDate,
                            taskStart,
                            taskEnd,
                            task.estimatedHours
                          );

                          if (hours <= 0) return null;

                          return {
                            name: task.name,
                            hours: Math.round(hours * 100) / 100,
                            dueDate: taskEnd
                          };
                        }).filter(Boolean) as Array<{ name: string; hours: number; dueDate: Date }>;

                        const projectContent = assignedContentInPeriod.filter(
                          (c) => contentProjectIdStr(c) === projectId
                        );

                        const contentHoursList = projectContent
                          .map((content) => {
                            const hours = content.estimatedHours || 0;
                            if (hours <= 0) return null;
                            const publishDate = content.publishDate
                              ? parseDateSafe(content.publishDate)
                              : null;
                            return {
                              name: content.title,
                              hours: Math.round(hours * 100) / 100,
                              dueDate: publishDate,
                            };
                          })
                          .filter(Boolean) as Array<{ name: string; hours: number; dueDate: Date | null }>;

                        const totalProjectHours =
                          taskHoursList.reduce((sum, t) => sum + t.hours, 0) +
                          contentHoursList.reduce((sum, c) => sum + c.hours, 0);

                        return (
                          <div key={projectId} className="space-y-1">
                            <div
                              className="text-xs p-1.5 rounded"
                              style={{ backgroundColor: project.color + '20' }}
                            >
                              <div className="font-medium text-text-primary truncate">
                                {project.name}
                              </div>
                              {totalProjectHours > 0 && (
                                <div className="text-text-secondary">
                                  {totalProjectHours.toFixed(1)}h
                                </div>
                              )}
                            </div>

                            {taskHoursList.map((taskInfo, idx) => {
                              const isTaskDueOnViewDay = taskOverlapsViewDay(
                                currentDate,
                                taskInfo.dueDate,
                                taskInfo.dueDate
                              );

                              return (
                                <div
                                  key={`task-${projectId}-${idx}`}
                                  className="text-xs p-1.5 rounded ml-3"
                                  style={{ backgroundColor: project.color + '15' }}
                                >
                                  <div className="text-text-primary truncate">
                                    • {taskInfo.name}
                                  </div>
                                  <div className="text-text-secondary">
                                    {taskInfo.hours}h
                                  </div>
                                  <div className="text-text-muted text-[10px] mt-0.5">
                                    Due: {isTaskDueOnViewDay ? 'Today' : formatDate(taskInfo.dueDate)}
                                  </div>
                                </div>
                              );
                            })}

                            {contentHoursList.map((contentInfo, idx) => {
                              const dueLabel =
                                contentInfo.dueDate &&
                                taskOverlapsViewDay(currentDate, contentInfo.dueDate, contentInfo.dueDate)
                                  ? 'Today'
                                  : contentInfo.dueDate
                                    ? formatDate(contentInfo.dueDate)
                                    : '—';

                              return (
                                <div
                                  key={`content-${projectId}-${idx}`}
                                  className="text-xs p-1.5 rounded ml-3"
                                  style={{ backgroundColor: project.color + '15' }}
                                >
                                  <div className="text-text-primary truncate">
                                    • {contentInfo.name}
                                    <span className="text-text-muted ml-1">(content)</span>
                                  </div>
                                  <div className="text-text-secondary">
                                    {contentInfo.hours}h
                                  </div>
                                  <div className="text-text-muted text-[10px] mt-0.5">
                                    Publish: {dueLabel}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        );
      })}
    </div>
  );
}
