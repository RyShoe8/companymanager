'use client';

import { useMemo, useState, useCallback } from 'react';
import { IEmployee } from '@/lib/models/Employee';
import { IProject, IProjectTask } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { TimeframeType, getTimeframeRange, formatDate } from '@/lib/utils/dateUtils';
import Card from '@/components/ui/Card';

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
  const employeeId = employee._id.toString();
  if (!project.tasks) return [];
  return project.tasks.filter((task) => {
    const taskAssignedToId = (task as { assignedToEmployeeId?: unknown }).assignedToEmployeeId?.toString();
    const taskAssignedToName = task.assignedTo;
    const isAssignedById = taskAssignedToId === employeeId;
    const isAssignedByName = !!(taskAssignedToName && taskAssignedToName === employee.name);
    return (isAssignedById || isAssignedByName) && task.status !== 'completed';
  });
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
      // Check if today is a weekday
      const today = new Date(startDate);
      const dayOfWeek = today.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Today is a weekday = weeklyHours / 5
        return Math.round((employee.weeklyHours / 5) * 100) / 100;
      } else {
        // Today is a weekend = 0 hours
        return 0;
      }
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

      // Check if any task is assigned to this employee by ID
      if (project.tasks && project.tasks.some(task => {
        const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
        if (taskAssignedToId === employeeIdStr) {
          return true;
        }
        // Check legacy name field
        if (task.assignedTo && task.assignedTo === employee.name) {
          return true;
        }
        return false;
      })) {
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

  // Helper function to calculate hours for a date range (weekdays only)
  const calculateHoursForDateRange = (
    rangeStart: Date,
    rangeEnd: Date,
    projectStart: Date,
    projectEnd: Date,
    totalHours: number
  ): number => {
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
          .filter(task => {
            const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
            return taskAssignedToId === employee._id.toString() && task.estimatedHours && task.status !== 'completed';
          })
          .reduce((sum, task) => {
            hasEmployeeTasks = true;
            if (!task.estimatedHours || !task.startDate || !task.endDate) return sum;
            const taskStart = new Date(task.startDate);
            const taskEnd = new Date(task.endDate);
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
            const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
            if (task.estimatedHours && task.status !== 'completed' && taskAssignedToId !== employee._id.toString()) {
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



    // Add hours from content items
    if (contentItems) {
      const employeeContentItems = contentItems.filter(c => c.assignedToEmployeeId?.toString() === employee._id.toString());
      employeeContentItems.forEach(content => {
        if (content.status === 'published') return;
        const hours = content.estimatedHours || 0;
        if (hours <= 0) return;

        if (content.publishDate) {
          const publishDate = new Date(content.publishDate);
          const normDate = normalizeToStartOfDay(publishDate);
          const rangeStart = normalizeToStartOfDay(startDate);
          const rangeEnd = normalizeToEndOfDay(endDate);

          if (normDate >= rangeStart && normDate <= rangeEnd) {
            const day = normDate.getDay();
            if (day >= 1 && day <= 5) {
              totalHours += hours;
            }
          }
        } else if (timeframe !== 'today') {
          totalHours += hours;
        }
      });
    }

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
          .filter(task => {
            const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
            return taskAssignedToId === employee._id.toString() && task.estimatedHours && task.status !== 'completed';
          })
          .reduce((sum, task) => {
            if (!task.estimatedHours || !task.startDate || !task.endDate) return sum;
            const taskStart = new Date(task.startDate);
            const taskEnd = new Date(task.endDate);
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
            const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
            if (task.estimatedHours && task.status !== 'completed' && taskAssignedToId !== employee._id.toString()) {
              otherEmployeeTaskHours += task.estimatedHours;
            }
          });
        }
        const remainingProjectHours = Math.max(0, project.estimatedHours - otherEmployeeTaskHours);
        breakdown[stage] += remainingProjectHours;
      }
    });

    if (contentItems) {
      const employeeContentItems = contentItems.filter(c => c.assignedToEmployeeId?.toString() === employee._id.toString());
      employeeContentItems.forEach(content => {
        if (content.status === 'published') return;
        const hours = content.estimatedHours || 0;
        if (hours <= 0) return;

        const stage = content.projectId ? getProjectStage(calcProjects.find(p => p._id.toString() === content.projectId?.toString())?.status || 'planning') : 'Plan';

        if (content.publishDate) {
          const publishDate = new Date(content.publishDate);
          const normDate = normalizeToStartOfDay(publishDate);
          const rangeStart = normalizeToStartOfDay(startDate);
          const rangeEnd = normalizeToEndOfDay(endDate);

          if (normDate >= rangeStart && normDate <= rangeEnd) {
            const day = normDate.getDay();
            if (day >= 1 && day <= 5) {
              breakdown[stage] += hours;
            }
          }
        } else if (timeframe !== 'today') {
          breakdown[stage] += hours;
        }
      });
    }

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
          .filter(task => {
            const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
            return taskAssignedToId === employee._id.toString() && task.estimatedHours && (task.status === 'completed');
          })
          .reduce((sum, task) => {
            if (!task.estimatedHours || !task.startDate || !task.endDate) return sum;
            const taskStart = new Date(task.startDate);
            const taskEnd = new Date(task.endDate);
            return sum + calculateHoursForDateRange(startDate, endDate, taskStart, taskEnd, task.estimatedHours);
          }, 0);
        breakdown[stage] += taskHoursInRange;
      }

      const projectAssignedToId = (project as any).assignedToEmployeeId?.toString();
      if (projectAssignedToId === employee._id.toString() && project.estimatedHours) {
        let otherEmployeeTaskHours = 0;
        if (project.tasks && project.tasks.length > 0) {
          project.tasks.forEach((task) => {
            const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
            if (task.estimatedHours && (task.status === 'completed') && taskAssignedToId !== employee._id.toString()) {
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
          const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
          if (taskAssignedToId === employee._id.toString() && task.estimatedHours && task.status === 'completed') {
            employeeTaskHours += task.estimatedHours;
          }
        });
      }

      // If employee has completed tasks assigned, count those task hours
      if (employeeTaskHours > 0 && project.tasks) {
        const taskHoursInRange = project.tasks
          .filter(task => {
            const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
            return taskAssignedToId === employee._id.toString() && task.estimatedHours && (task.status === 'completed');
          })
          .reduce((sum, task) => {
            if (!task.estimatedHours || !task.startDate || !task.endDate) return sum;
            const taskStart = new Date(task.startDate);
            const taskEnd = new Date(task.endDate);
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
            const taskAssignedToId = (task as any).assignedToEmployeeId?.toString();
            if (task.estimatedHours && (task.status === 'completed') && taskAssignedToId !== employee._id.toString()) {
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



    if (contentItems) {
      const employeeContentItems = contentItems.filter(c => c.assignedToEmployeeId?.toString() === employee._id.toString());
      employeeContentItems.forEach(content => {
        if (content.status !== 'published') return;
        const hours = content.estimatedHours || 0;
        if (hours <= 0) return;

        if (content.publishDate) {
          const publishDate = new Date(content.publishDate);
          const normDate = normalizeToStartOfDay(publishDate);
          const rangeStart = normalizeToStartOfDay(startDate);
          const rangeEnd = normalizeToEndOfDay(endDate);

          if (normDate >= rangeStart && normDate <= rangeEnd) {
            const day = normDate.getDay();
            if (day >= 1 && day <= 5) {
              totalHours += hours;
            }
          }
        } else if (timeframe !== 'today') {
          totalHours += hours;
        }
      });
    }

    return Math.round(totalHours * 100) / 100;
  };

  if (employees.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
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
            <p className="text-lg font-bold text-text-primary">{Math.round(teamTotals.total)}h</p>
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
                Committed: {Math.round(teamTotals.committed)}h
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
        const utilizationProjects = employeeProjects.filter(
          (p) => getOpenTasksAssignedToEmployee(p, employee).length > 0
        );

        const utilizationPercent = totalHours > 0 ? Math.round((committedHours / totalHours) * 100) : 0;

        const committedHoursRounded = Math.round(committedHours);
        const totalHoursRounded = Math.round(totalHours);

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
                  <span className={`text-xs px-1.5 py-0.5 rounded ${employee.role === 'Administrator' ? 'bg-yellow-100 text-yellow-800' :
                    employee.role === 'Manager' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                    {employee.role}
                  </span>
                </div>
              </div>

              {/* Utilization (hours for selected period) - Always visible */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-text-secondary mb-1">
                  <span>Utilization (this period)</span>
                  <span>{committedHoursRounded}h / {totalHoursRounded}h{totalHours > 0 ? ` (${utilizationPercent}%)` : ''}</span>
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
                  <p className="text-sm text-gray-600 mb-2">{employee.jobTitle}</p>
                )}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded ${employee.employeeType === 'full-time' ? 'bg-blue-100 text-blue-800' :
                    employee.employeeType === 'part-time' ? 'bg-green-100 text-green-800' :
                      'bg-purple-100 text-purple-800'
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
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200" title={`Plan: ${committedBreakdown.Plan}h`}>
                            📋 {committedBreakdown.Plan}h
                          </span>
                        )}
                        {hasBuild && (
                          <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200" title={`Build: ${committedBreakdown.Build}h`}>
                            🔨 {committedBreakdown.Build}h
                          </span>
                        )}
                        {hasRun && (
                          <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200" title={`Run: ${committedBreakdown.Run}h`}>
                            🚀 {committedBreakdown.Run}h
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Available:</span>
                    <span className="font-medium text-gray-900">{totalHours}h</span>
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
                        <span className="text-gray-500 text-sm">{expandedBreakdowns.has(`${employeeId}-committed`) ? '▼' : '▶'}</span>
                        <span className="text-gray-600">Committed:</span>
                        <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">(click to expand)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-orange-600">{committedHoursRounded}h</span>
                      </div>
                    </button>
                    {expandedBreakdowns.has(`${employeeId}-committed`) && (() => {
                      const breakdown = getCommittedHoursBreakdown(employee);
                      return (
                        <div className="ml-4 mt-1 space-y-1 text-xs text-gray-500">
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
                        <span className="text-gray-500 text-sm">{expandedBreakdowns.has(`${employeeId}-completed`) ? '▼' : '▶'}</span>
                        <span className="text-gray-600">Completed:</span>
                        <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">(click to expand)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-green-600">{Math.round(completedHours)}h</span>
                      </div>
                    </button>
                    {expandedBreakdowns.has(`${employeeId}-completed`) && (() => {
                      const breakdown = getCompletedHoursBreakdown(employee);
                      return (
                        <div className="ml-4 mt-1 space-y-1 text-xs text-gray-500">
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
                    <span className="text-gray-600">Remaining:</span>
                    <span className={`font-medium ${totalHours - committedHours > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Math.round((totalHours - committedHours) * 100) / 100}h
                    </span>
                  </div>
                </div>

                {/* Projects where this employee has assigned tasks */}
                {utilizationProjects.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-medium text-gray-700 mb-2">Tasks assigned to you:</p>
                    <div className="space-y-1 max-h-[300px] overflow-y-auto">
                      {utilizationProjects.map((project) => {
                        const assignedTasks = getOpenTasksAssignedToEmployee(project, employee);

                        const taskHoursList = assignedTasks.map(task => {
                          if (!task.estimatedHours || !task.startDate || !task.endDate) return null;
                          const taskStart = new Date(task.startDate);
                          const taskEnd = new Date(task.endDate);

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

                        const totalProjectHours = taskHoursList.reduce((sum, t) => sum + t.hours, 0);

                        return (
                          <div key={project._id.toString()} className="space-y-1">
                            <div
                              className="text-xs p-1.5 rounded"
                              style={{ backgroundColor: project.color + '20' }}
                            >
                              <div className="font-medium text-gray-900 truncate">
                                {project.name}
                              </div>
                              {totalProjectHours > 0 && (
                                <div className="text-gray-600">
                                  {totalProjectHours.toFixed(1)}h
                                </div>
                              )}
                            </div>

                            {taskHoursList.map((taskInfo, idx) => {
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              const dueDateNormalized = new Date(taskInfo.dueDate);
                              dueDateNormalized.setHours(0, 0, 0, 0);
                              const isTaskDueToday = dueDateNormalized.getTime() === today.getTime();

                              return (
                                <div
                                  key={`task-${project._id.toString()}-${idx}`}
                                  className="text-xs p-1.5 rounded ml-3"
                                  style={{ backgroundColor: project.color + '15' }}
                                >
                                  <div className="text-gray-700 truncate">
                                    • {taskInfo.name}
                                  </div>
                                  <div className="text-gray-600">
                                    {taskInfo.hours}h
                                  </div>
                                  <div className="text-gray-500 text-[10px] mt-0.5">
                                    Due: {isTaskDueToday ? 'Today' : formatDate(taskInfo.dueDate)}
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
