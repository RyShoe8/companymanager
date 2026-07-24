'use client';

import { useMemo, useState, useCallback } from 'react';
import { IEmployee } from '@/lib/models/Employee';
import { IProject } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { IMeeting } from '@/lib/models/Meeting';
import { TimeframeType, formatDate, parseDateSafe, taskOverlapsViewDay } from '@/lib/utils/dateUtils';
import { isTaskAssignedToEmployee } from '@/lib/utils/projectTeam';
import Card from '@/components/ui/Card';
import {
  useEmployeeCapacityCalculations,
  getAssignedTasksInViewPeriod,
  getAssignedContentInViewPeriod,
  contentProjectIdStr,
} from '@/hooks/useEmployeeCapacityCalculations';

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

function employeeTypeLabel(employeeType?: string): string {
  if (employeeType === 'full-time') return 'Full-Time';
  if (employeeType === 'part-time') return 'Part-Time';
  return 'Contractor';
}

const utilizationBadgeBase =
  'text-xs font-medium px-2 py-0.5 rounded-md border shrink-0';

function roleBadgeClass(role?: string): string {
  if (role === 'Administrator') {
    return `${utilizationBadgeBase} bg-amber-500/25 text-amber-300 border-amber-400/40`;
  }
  if (role === 'Manager') {
    return `${utilizationBadgeBase} bg-blue-500/25 text-blue-300 border-blue-400/40`;
  }
  return `${utilizationBadgeBase} bg-white/10 text-text-primary border-white/20`;
}

function employeeTypeBadgeClass(employeeType?: string): string {
  if (employeeType === 'full-time') {
    return `${utilizationBadgeBase} bg-sky-500/25 text-sky-300 border-sky-400/40`;
  }
  if (employeeType === 'part-time') {
    return `${utilizationBadgeBase} bg-emerald-500/25 text-emerald-300 border-emerald-400/40`;
  }
  return `${utilizationBadgeBase} bg-violet-500/25 text-violet-300 border-violet-400/40`;
}

interface EmployeeSidebarProps {
  employees: IEmployee[];
  projects: IProject[]; // Filtered projects for display (by page stage)
  allProjects?: IProject[]; // All projects for calculations (across all stages)
  contentItems?: IContentItem[]; // Content items for calculations
  meetings?: IMeeting[];
  timeframe: TimeframeType;
  currentDate: Date;
  currentUserRole?: 'Administrator' | 'Manager' | 'User';
  currentUserEmployeeId?: string | null;
}

export default function EmployeeSidebar({ employees, projects, allProjects, contentItems, meetings = [], timeframe, currentDate, currentUserRole, currentUserEmployeeId }: EmployeeSidebarProps) {
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Set<string>>(new Set()); // Track which breakdowns are expanded (e.g., "employeeId-committed")

  const {
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
  } = useEmployeeCapacityCalculations({ projects, allProjects, contentItems, meetings, timeframe, currentDate });

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

  // Filter employees based on role - memoized to recalculate when role or employee list changes
  // Hooks must run unconditionally (no early return above this).
  const visibleEmployees = useMemo(() => {
    // Filter to only employees with userId (registered users)
    const employeesWithUserId = employees.filter(employee => employee.userId != null);

    // If role is not set yet, show nothing until role resolves
    if (!currentUserRole) {
      return [];
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
    const meetingHours = getMeetingHours(employee);
    const completedHours = getCompletedHours(employee);
    const availableHoursForDisplay = totalAvailableHours(employee);
    const totalCap = totalAvailableHours(employee);

    return {
      committed: totals.committed + committedHours,
      meetings: totals.meetings + meetingHours,
      completed: totals.completed + completedHours,
      available: totals.available + (totalCap - committedHours),
      total: totals.total + totalCap
    };
  }, { committed: 0, meetings: 0, completed: 0, available: 0, total: 0 });

  const teamUtilizationPercent = teamTotals.total > 0
    ? Math.round((teamTotals.committed / teamTotals.total) * 100)
    : 0;

  const utilizationCardSurface = 'p-4 bg-background-elevated border-border';

  if (employees.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted">
        <p className="mb-2">No employees added yet</p>
        <p className="text-sm">Add employees to track their workload</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-tour="employee-sidebar">
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
                {teamTotals.meetings > 0 ? (
                  <span className="text-text-muted"> (incl. {formatUtilizationHours(teamTotals.meetings, timeframe)}h meetings)</span>
                ) : null}
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
                  <span className={roleBadgeClass(employee.role)}>{employee.role}</span>
                  <span className={employeeTypeBadgeClass(employee.employeeType)}>
                    {employeeTypeLabel(employee.employeeType)}
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
                  {(() => {
                    const committedBreakdown = getCommittedHoursBreakdown(employee);
                    const taskHours = sumAssignedTaskHoursInPeriod(employee);
                    const contentHours = sumAssignedContentHoursInPeriod(employee);
                    const meetingHours = getMeetingHours(employee);
                    const pills: { key: string; title: string; label: string; className: string }[] = [];
                    if (committedBreakdown.Plan > 0) {
                      pills.push({
                        key: 'plan',
                        title: `Plan: ${committedBreakdown.Plan}h`,
                        label: `ðŸ“‹ ${committedBreakdown.Plan}h`,
                        className:
                          'px-2 py-0.5 rounded-md font-medium bg-cyan-500/25 text-cyan-300 border border-cyan-400/40',
                      });
                    }
                    if (committedBreakdown.Build > 0) {
                      pills.push({
                        key: 'build',
                        title: `Build: ${committedBreakdown.Build}h`,
                        label: `ðŸ”¨ ${committedBreakdown.Build}h`,
                        className:
                          'px-2 py-0.5 rounded-md font-medium bg-amber-500/25 text-amber-300 border border-amber-400/40',
                      });
                    }
                    if (committedBreakdown.Run > 0) {
                      pills.push({
                        key: 'run',
                        title: `Run: ${committedBreakdown.Run}h`,
                        label: `ðŸš€ ${committedBreakdown.Run}h`,
                        className:
                          'px-2 py-0.5 rounded-md font-medium bg-emerald-500/25 text-emerald-300 border border-emerald-400/40',
                      });
                    }
                    if (taskHours > 0) {
                      pills.push({
                        key: 'tasks',
                        title: `Tasks: ${taskHours}h`,
                        label: `âœ… ${taskHours}h`,
                        className:
                          'px-2 py-0.5 rounded-md font-medium bg-sky-500/20 text-sky-300 border border-sky-400/30',
                      });
                    }
                    if (contentHours > 0) {
                      pills.push({
                        key: 'content',
                        title: `Content: ${contentHours}h`,
                        label: `ðŸ“ ${contentHours}h`,
                        className:
                          'px-2 py-0.5 rounded-md font-medium bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-400/30',
                      });
                    }
                    if (meetingHours > 0) {
                      pills.push({
                        key: 'meetings',
                        title: `Meetings: ${meetingHours}h`,
                        label: `ðŸ“… ${meetingHours}h`,
                        className:
                          'px-2 py-0.5 rounded-md font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-400/30',
                      });
                    }

                    if (pills.length === 0) return null;

                    return (
                      <div className="flex items-center gap-1.5 text-xs flex-wrap">
                        {pills.map((pill) => (
                          <span key={pill.key} className={pill.className} title={pill.title}>
                            {pill.label}
                          </span>
                        ))}
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
                        <span className="text-text-muted text-sm">{expandedBreakdowns.has(`${employeeId}-committed`) ? 'â–¼' : 'â–¶'}</span>
                        <span className="text-text-secondary">Committed:</span>
                        <span className="text-xs text-text-muted group-hover:text-text-secondary transition-colors">(click to expand)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-warning">{committedHoursDisplay}h</span>
                      </div>
                    </button>
                    {expandedBreakdowns.has(`${employeeId}-committed`) && (() => {
                      const breakdown = getCommittedHoursBreakdown(employee);
                      const meetingHours = getMeetingHours(employee);
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
                          {meetingHours > 0 ? (
                            <div className="flex justify-between">
                              <span>Meetings:</span>
                              <span>{meetingHours}h</span>
                            </div>
                          ) : null}
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
                        <span className="text-text-muted text-sm">{expandedBreakdowns.has(`${employeeId}-completed`) ? 'â–¼' : 'â–¶'}</span>
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
                                    <span className="mr-1" aria-hidden>âœ…</span>
                                    {taskInfo.name}
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
                                    : 'â€”';

                              return (
                                <div
                                  key={`content-${projectId}-${idx}`}
                                  className="text-xs p-1.5 rounded ml-3"
                                  style={{ backgroundColor: project.color + '15' }}
                                >
                                  <div className="text-text-primary truncate">
                                    <span className="mr-1" aria-hidden>ðŸ“</span>
                                    {contentInfo.name}
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
