'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { IProject, IProjectTask } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import {
  TimeframeType,
  getTimeframeRange,
  parseDateSafe,
  taskOverlapsViewRange,
  publishDateOnViewDay,
  localCalendarDayIndex,
  taskCalendarDayIndex,
} from '@/lib/utils/dateUtils';
import {
  computeProjectAssignedHours,
  sumContentHoursInTimeframe,
  sumTaskHoursInTimeframe,
} from '@/lib/utils/projectHours';
import {
  filterContentToSeriesRepresentatives,
  filterTasksToSeriesRepresentatives,
} from '@/lib/recurrence/filterSeriesRepresentatives';
import { resolveTaskIndexInProject } from '@/lib/utils/resolveTaskIndex';
import { getProjectStatusDisplayLabel } from '@/lib/utils/statusMapping';
import {
  getCalendarPeriodTitle,
  navigateCalendarPeriod,
} from '@/lib/utils/calendarPeriodNav';
import CalendarPeriodHeader from '@/components/planning-map/CalendarPeriodHeader';
import ProjectTimeframeItemsModal, { TimeframeTaskItem } from './ProjectTimeframeItemsModal';
import { getTaskAssigneeEmployeeIds, isEmployeeOnProjectTeam } from '@/lib/utils/projectTeam';
import { contentPassesAssignmentFilter } from '@/lib/utils/assigneeDisplay';
import { getProjectCardHeaderTextClass } from '@/lib/utils/colorContrast';
import {
  buildContentItemsByProjectId,
  getProjectLatestActivityMs,
} from '@/lib/utils/projectLatestActivity';
import ActionMenu from '@/components/ui/ActionMenu';
import ItemSeenTag from '@/components/workspace/ItemSeenTag';
import {
  buildContentItemKey,
  buildTaskItemKey,
  collectWorkspaceItemObservations,
  type ItemSeenStatus,
  observeItemsForUser,
  readObservedItemsForUser,
} from '@/lib/workspace/itemSeenState';
import { projectOverlapsDateRange } from '@/lib/utils/projectCalendarOverlap';
import {
  isActiveWorkspaceContent,
  isActiveWorkspaceTask,
} from '@/lib/workspace/activeWorkspaceItems';

function taskOverlapsWeek(
  task: { startDate?: Date | string; endDate?: Date | string },
  weekStartDay: Date,
  weekEndDay: Date
): boolean {
  const taskStart = parseDateSafe(task.startDate);
  const taskEnd = parseDateSafe(task.endDate);
  if (!taskStart || !taskEnd) return false;
  return taskOverlapsViewRange(weekStartDay, weekEndDay, taskStart, taskEnd);
}

const RANGE_ITEM_ROW_HEIGHT = 140;
const UNSEEN_COLLAPSED_ROW_HEIGHT = 28;
const UNSEEN_SECTION_PADDING = 12;
const WEEKLY_EXPANDED_LIST_MAX_HEIGHT = 360;
const WEEKLY_HEADER_HEIGHT = 72;
const WEEKLY_BOTTOM_PADDING = 24;
const MONTHLY_EXPANDED_LIST_MAX_HEIGHT = 400;

interface CalendarViewProps {
  projects: IProject[];
  contentItems?: IContentItem[];
  showTasks?: boolean;
  showContent?: boolean;
  contentChannelFilter?: string;
  timeframe: TimeframeType;
  currentDate: Date;
  onProjectClick: (project: IProject) => void;
  onDateChange?: (date: Date) => void;
  currentUserEmployeeName?: string | null;
  currentUserEmployeeId?: string | null;
  currentUserId?: string | null;
  isManagerOrAdmin?: boolean;
  showOnlyMyAssignments?: boolean;
  onContentItemClick?: (item: IContentItem) => void;
  onAddContent?: (project: IProject, defaultDate?: Date) => void;
  onAddTask?: (project: IProject) => void;
  onRefreshContent?: () => void;
  onTaskClick?: (project: IProject, taskIndex: number) => void;
  itemSeenRefreshTrigger?: number;
}

export type MergedCalendarItem =
  | { type: 'task'; task: IProjectTask; date: Date }
  | { type: 'content'; content: IContentItem };

function isActiveMergedCalendarItem(item: MergedCalendarItem): boolean {
  return item.type === 'task'
    ? isActiveWorkspaceTask(item.task)
    : isActiveWorkspaceContent(item.content);
}

export default function CalendarView({
  projects,
  contentItems = [],
  showTasks = true,
  showContent = true,
  contentChannelFilter = 'All',
  timeframe,
  currentDate,
  onProjectClick,
  onDateChange,
  currentUserEmployeeName,
  currentUserEmployeeId,
  currentUserId,
  isManagerOrAdmin = false,
  showOnlyMyAssignments = false,
  onContentItemClick,
  onAddContent,
  onAddTask,
  onRefreshContent,
  onTaskClick,
  itemSeenRefreshTrigger,
}: CalendarViewProps) {
  const [viewDate, setViewDate] = useState(currentDate);
  const [employees, setEmployees] = useState<any[]>([]);
  const [projectLatestComments, setProjectLatestComments] = useState<Map<string, Date>>(new Map());
  const [itemActivityByKey, setItemActivityByKey] = useState<Record<string, number>>({});
  const [itemStatusByKey, setItemStatusByKey] = useState<Record<string, ItemSeenStatus>>({});
  const prevActivityMsRef = useRef<Map<string, number>>(new Map());
  const hasInitializedActivityRef = useRef(false);

  const contentByProjectId = useMemo(
    () => buildContentItemsByProjectId(contentItems),
    [contentItems]
  );

  const taskKeyFor = useCallback(
    (project: IProject, task: IProjectTask, idx: number) =>
      buildTaskItemKey(
        project._id.toString(),
        (task as { _id?: { toString(): string } })._id?.toString() ?? null,
        idx
      ),
    []
  );

  const contentKeyFor = useCallback(
    (item: IContentItem) =>
      buildContentItemKey(item.projectId?.toString() ?? 'none', item._id.toString()),
    []
  );

  const workspaceItemEntries = useMemo(
    () => collectWorkspaceItemObservations(projects, contentItems),
    [projects, contentItems]
  );

  useEffect(() => {
    if (!currentUserId) return;
    const observed = observeItemsForUser(currentUserId, workspaceItemEntries);
    setItemActivityByKey(observed.activityByKey);
    setItemStatusByKey(observed.statusByKey);
  }, [currentUserId, workspaceItemEntries]);

  useEffect(() => {
    if (!currentUserId || (itemSeenRefreshTrigger ?? 0) <= 0) return;
    const keys = workspaceItemEntries.map((entry) => entry.key);
    const observed = readObservedItemsForUser(currentUserId, keys);
    setItemActivityByKey(observed.activityByKey);
    setItemStatusByKey(observed.statusByKey);
  }, [currentUserId, itemSeenRefreshTrigger, workspaceItemEntries]);

  const taskActivityMs = useCallback(
    (project: IProject, task: IProjectTask, idx: number) =>
      itemActivityByKey[taskKeyFor(project, task, idx)] ?? 0,
    [itemActivityByKey, taskKeyFor]
  );

  const contentActivityMs = useCallback(
    (item: IContentItem) => itemActivityByKey[contentKeyFor(item)] ?? 0,
    [itemActivityByKey, contentKeyFor]
  );

  const projectBadgeEligible = useCallback(
    (project: IProject): boolean =>
      !!currentUserEmployeeId &&
      !!isManagerOrAdmin &&
      isEmployeeOnProjectTeam(project, currentUserEmployeeId),
    [currentUserEmployeeId, isManagerOrAdmin]
  );

  // Load expanded projects from localStorage on mount
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('calendar-expanded-projects');
      if (saved) {
        try {
          const projectIds = JSON.parse(saved);
          return new Set(projectIds);
        } catch (e) {
          return new Set();
        }
      }
    }
    return new Set();
  });

  // Save expanded projects to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const projectIds = Array.from(expandedProjects);
      localStorage.setItem('calendar-expanded-projects', JSON.stringify(projectIds));
    }
  }, [expandedProjects]);

  // Fetch employees to resolve names from IDs
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await fetch('/api/employees');
        if (response.ok) {
          const data = await response.json();
          setEmployees(data);
        }
      } catch (error) {
        // Error fetching employees
      }
    };
    fetchEmployees();
  }, []);

  const getLatestActivityMs = useCallback(
    (project: IProject): number => {
      const projectId = project._id.toString();
      const commentDate = projectLatestComments.get(projectId);
      const commentMs = commentDate ? commentDate.getTime() : undefined;
      return getProjectLatestActivityMs(
        project,
        contentByProjectId.get(projectId) ?? [],
        commentMs
      );
    },
    [contentByProjectId, projectLatestComments]
  );

  // Fetch latest project comment timestamps in one request
  useEffect(() => {
    if (projects.length === 0) {
      setProjectLatestComments(new Map());
      return;
    }

    let cancelled = false;

    const fetchLatestComments = async () => {
      try {
        const projectIds = projects.map((project) => project._id.toString()).join(',');
        const response = await fetch(`/api/comments/activity?projectIds=${encodeURIComponent(projectIds)}`);
        if (!response.ok) return;

        const payload = (await response.json()) as {
          projectLatestComments?: Record<string, string>;
        };
        const commentMap = new Map<string, Date>();
        for (const [projectId, value] of Object.entries(payload.projectLatestComments ?? {})) {
          const timestamp = new Date(value);
          if (!Number.isNaN(timestamp.getTime())) {
            commentMap.set(projectId, timestamp);
          }
        }

        if (!cancelled) {
          setProjectLatestComments(commentMap);
        }
      } catch {
        // Ignore activity fetch errors.
      }
    };

    void fetchLatestComments();
    return () => {
      cancelled = true;
    };
  }, [projects]);

  // Auto-expand projects when activity increases (unless manually collapsed)
  useEffect(() => {
    if (projects.length === 0) return;

    const manuallyCollapsed = new Set<string>();
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('calendar-manually-collapsed-projects');
      if (saved) {
        try {
          const projectIds = JSON.parse(saved) as string[];
          projectIds.forEach((id) => manuallyCollapsed.add(id));
        } catch {
          // Ignore parse errors
        }
      }
    }

    const prev = prevActivityMsRef.current;
    const next = new Map<string, number>();
    const toExpand: string[] = [];

    for (const project of projects) {
      const projectId = project._id.toString();
      const activityMs = getLatestActivityMs(project);
      next.set(projectId, activityMs);

      if (hasInitializedActivityRef.current) {
        const prevMs = prev.get(projectId);
        if (prevMs !== undefined && activityMs > prevMs && !manuallyCollapsed.has(projectId)) {
          toExpand.push(projectId);
        }
      }
    }

    prevActivityMsRef.current = next;

    if (!hasInitializedActivityRef.current) {
      hasInitializedActivityRef.current = true;
      return;
    }

    if (toExpand.length > 0) {
      setExpandedProjects((prevSet) => {
        const updated = new Set(prevSet);
        for (const id of toExpand) {
          updated.add(id);
        }
        return updated;
      });
    }
  }, [projects, contentItems, projectLatestComments, getLatestActivityMs]);

  // Helper function to get employee name from ID or return the name if available
  const getEmployeeName = (assignedToId: string | undefined, assignedToName: string | undefined): string | undefined => {
    if (assignedToName) return assignedToName;
    if (assignedToId) {
      const employee = employees.find(emp => emp._id?.toString() === assignedToId);
      return employee?.name;
    }
    return undefined;
  };

  // Sort projects by latest activity (newest first)
  const sortProjectsByLatestUpdate = (projectList: IProject[]): IProject[] => {
    return [...projectList].sort((a, b) => {
      return getLatestActivityMs(b) - getLatestActivityMs(a);
    });
  };

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
        // Track manually collapsed projects
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('calendar-manually-collapsed-projects');
          const manuallyCollapsed = saved ? new Set(JSON.parse(saved)) : new Set<string>();
          manuallyCollapsed.add(projectId);
          localStorage.setItem('calendar-manually-collapsed-projects', JSON.stringify(Array.from(manuallyCollapsed)));
        }
      } else {
        newSet.add(projectId);
        // Remove from manually collapsed if it was there
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('calendar-manually-collapsed-projects');
          if (saved) {
            const manuallyCollapsed = new Set(JSON.parse(saved));
            manuallyCollapsed.delete(projectId);
            localStorage.setItem('calendar-manually-collapsed-projects', JSON.stringify(Array.from(manuallyCollapsed)));
          }
        }
      }
      return newSet;
    });
  };

  useEffect(() => {
    setViewDate(currentDate);
  }, [currentDate, timeframe]);

  const [timeframeModalOpen, setTimeframeModalOpen] = useState<{
    project: IProject;
    startDate: Date;
    endDate: Date;
  } | null>(null);

  function canAddContentToProject(project: IProject): boolean {
    if (isManagerOrAdmin) return true;
    if (!currentUserEmployeeId) return false;
    const pid = (project as any).assignedToEmployeeId?.toString();
    if (pid === currentUserEmployeeId) return true;
    const ids = (project as any).assignedToEmployeeIds;
    if (ids?.some((id: any) => id?.toString() === currentUserEmployeeId)) return true;
    if (project.tasks?.some((t) => getTaskAssigneeEmployeeIds(t).includes(currentUserEmployeeId))) return true;
    return false;
  }

  function formatTaskAssigneeLabel(task: IProjectTask): string | undefined {
    const ids = getTaskAssigneeEmployeeIds(task);
    const names = ids
      .map((id) => getEmployeeName(id, undefined))
      .filter((name): name is string => Boolean(name));
    if (names.length > 0) return names.join(', ');
    return getEmployeeName((task as { assignedToEmployeeId?: { toString(): string } }).assignedToEmployeeId?.toString(), task.assignedTo);
  }

  function taskPassesAssignmentFilter(task: IProjectTask): boolean {
    const assigneeIds = getTaskAssigneeEmployeeIds(task);
    if (showOnlyMyAssignments) {
      if (!currentUserEmployeeName && !currentUserEmployeeId) return true;
      if (currentUserEmployeeId && assigneeIds.includes(currentUserEmployeeId)) return true;
      return task.assignedTo === currentUserEmployeeName;
    }
    if (isManagerOrAdmin) return true;
    if (currentUserEmployeeName || currentUserEmployeeId) {
      if (currentUserEmployeeId && assigneeIds.includes(currentUserEmployeeId)) return true;
      return task.assignedTo === currentUserEmployeeName;
    }
    return true;
  }

  function taskSeenStatus(project: IProject, task: IProjectTask): ItemSeenStatus {
    if (!currentUserEmployeeId) return 'none';
    if (projectBadgeEligible(project)) {
      const idx = resolveTaskIndexInProject(project, task);
      return itemStatusByKey[taskKeyFor(project, task, idx)] ?? 'none';
    }
    if (!getTaskAssigneeEmployeeIds(task).includes(currentUserEmployeeId)) return 'none';
    const idx = resolveTaskIndexInProject(project, task);
    return itemStatusByKey[taskKeyFor(project, task, idx)] ?? 'none';
  }

  function contentSeenStatus(project: IProject, item: IContentItem): ItemSeenStatus {
    if (!currentUserEmployeeId) return 'none';
    if (!projectBadgeEligible(project) && item.assignedToEmployeeId?.toString() !== currentUserEmployeeId) {
      return 'none';
    }
    return itemStatusByKey[contentKeyFor(item)] ?? 'none';
  }

  function itemSeenStatus(project: IProject, item: MergedCalendarItem): ItemSeenStatus {
    if (item.type === 'task') return taskSeenStatus(project, item.task);
    return contentSeenStatus(project, item.content);
  }

  function filterUnseenItems(project: IProject, displayList: MergedCalendarItem[]): MergedCalendarItem[] {
    return displayList.filter((item) => itemSeenStatus(project, item) !== 'none');
  }

  function collapsedUnseenRowsHeight(unseenCount: number): number {
    if (unseenCount <= 0) return 0;
    return (
      UNSEEN_SECTION_PADDING +
      unseenCount * UNSEEN_COLLAPSED_ROW_HEIGHT +
      Math.max(0, unseenCount - 1) * 4
    );
  }

  function renderCollapsedUnseenRows(
    project: IProject,
    unseenItems: MergedCalendarItem[],
    textClass: string,
    keyPrefix: string
  ) {
    if (unseenItems.length === 0) return null;
    return (
      <div className={`space-y-1 px-6 pb-4 ${textClass}`}>
        {unseenItems.map((item, idx) => {
          if (item.type === 'task') {
            const tIdx = resolveTaskIndexInProject(project, item.task);
            return (
              <button
                key={`${keyPrefix}-unseen-t-${idx}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (tIdx >= 0) onTaskClick?.(project, tIdx);
                }}
                className={`text-sm text-left w-full min-w-0 truncate hover:underline ${item.task.status === 'completed' ? 'line-through opacity-60' : ''}`}
                title={item.task.name}
              >
                <ItemSeenTag status={taskSeenStatus(project, item.task)} />
                {item.task.name}
              </button>
            );
          }
          return (
            <button
              key={`${keyPrefix}-unseen-c-${item.content._id.toString()}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onContentItemClick?.(item.content);
              }}
              className={`text-sm text-left w-full min-w-0 truncate hover:underline ${item.content.status === 'published' ? 'opacity-60' : ''}`}
              title={item.content.title}
            >
              <ItemSeenTag status={contentSeenStatus(project, item.content)} />
              {item.content.title}
            </button>
          );
        })}
      </div>
    );
  }

  function renderExpandedRangeItems(
    project: IProject,
    displayList: MergedCalendarItem[],
    keyPrefix: string
  ) {
    if (displayList.length === 0) return null;
    return (
      <div className="space-y-2">
        {displayList.map((item, idx) => {
          if (item.type === 'task') {
            const task = item.task;
            const tIdx = resolveTaskIndexInProject(project, task);
            return (
              <button
                key={`${keyPrefix}-task-${idx}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (tIdx >= 0) onTaskClick?.(project, tIdx);
                }}
                className="w-full min-w-0 text-left p-3 rounded border border-border bg-background-card hover:bg-background-card/80 transition-colors cursor-pointer overflow-hidden"
                style={{ height: RANGE_ITEM_ROW_HEIGHT }}
              >
                <div
                  className={`font-medium text-text-primary line-clamp-2 ${task.status === 'completed' ? 'line-through opacity-60' : ''}`}
                  title={task.name}
                >
                  <ItemSeenTag status={taskSeenStatus(project, task)} />
                  {task.name}
                </div>
                {task.description && (
                  <p className="text-sm text-text-secondary mt-1 max-h-10 overflow-hidden">
                    {task.description}
                  </p>
                )}
                <div className="flex gap-4 mt-2 text-xs text-text-secondary">
                  {task.estimatedHours && <span>{task.estimatedHours}h</span>}
                  {formatTaskAssigneeLabel(task) && (
                    <span>Assigned: {formatTaskAssigneeLabel(task)}</span>
                  )}
                  <span className="capitalize">{task.status}</span>
                </div>
              </button>
            );
          }
          const c = item.content;
          return (
            <div
              key={c._id.toString()}
              className={`p-3 rounded border border-dashed border-border bg-background-card overflow-hidden ${c.status === 'published' ? 'opacity-60' : ''}`}
              style={{ height: RANGE_ITEM_ROW_HEIGHT }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onContentItemClick?.(c);
                }}
                className="text-left w-full h-full"
              >
                <span
                  className={`font-medium text-text-primary line-clamp-2 ${c.status === 'published' ? 'line-through' : ''}`}
                  title={c.title}
                >
                  <ItemSeenTag status={contentSeenStatus(project, c)} />
                  {c.title}
                </span>
                <span className="ml-2 px-2 py-0.5 rounded text-xs bg-muted text-text-secondary">
                  {c.channel}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  function getMergedItemsForProject(
    project: IProject,
    rangeStart: Date,
    rangeEnd: Date,
    options: { forTodayView?: boolean }
  ): { merged: MergedCalendarItem[]; taskItems: TimeframeTaskItem[]; contentInRange: IContentItem[] } {
    const projectIdStr = project._id.toString();

    const taskItems: TimeframeTaskItem[] = [];
    const displayTasks =
      showTasks && project.tasks
        ? filterTasksToSeriesRepresentatives(project.tasks, {
            mode: 'active',
            referenceDate: currentDate,
          })
        : [];
    const projectContent = contentItems.filter(
      (item) => item.projectId?.toString() === projectIdStr
    );
    const displayContent = showContent
      ? filterContentToSeriesRepresentatives(projectContent, {
          mode: 'active',
          referenceDate: currentDate,
        })
      : [];
    if (showTasks) {
      displayTasks.forEach((task) => {
        const taskStart = parseDateSafe((task as { startDate?: Date | string }).startDate);
        const taskEnd = parseDateSafe((task as { endDate?: Date | string }).endDate);
        if (!taskStart || !taskEnd) return;
        if (taskOverlapsViewRange(rangeStart, rangeEnd, taskStart, taskEnd)) {
          taskItems.push({ task, startDate: taskStart, endDate: taskEnd });
        }
      });
    }

    let contentInRange: IContentItem[] = [];
    if (showContent && displayContent.length > 0) {
      contentInRange = displayContent.filter((item) => {
        if (contentChannelFilter !== 'All' && item.channel !== contentChannelFilter) return false;
        if (
          !contentPassesAssignmentFilter(item, {
            showOnlyMyAssignments,
            isManagerOrAdmin,
            currentUserEmployeeId: currentUserEmployeeId ?? null,
            currentUserEmployeeName: currentUserEmployeeName ?? null,
          })
        ) {
          return false;
        }
        // If no publishDate, still show the item (like tasks without dates)
        if (!item.publishDate) return true;
        const d = parseDateSafe(item.publishDate);
        if (!d) return true;
        // Check if publish date falls within the view range
        const v0 = localCalendarDayIndex(rangeStart);
        const v1 = localCalendarDayIndex(rangeEnd);
        const t0 = taskCalendarDayIndex(d);
        return t0 >= v0 && t0 <= v1;
      });
    }

    const merged: MergedCalendarItem[] = [];
    taskItems.forEach(({ task, startDate: sd }) => {
      merged.push({ type: 'task', task, date: sd });
    });
    contentInRange.forEach((c) => {
      merged.push({ type: 'content', content: c });
    });
    merged.sort((a, b) => {
      const aDone = a.type === 'task' && a.task.status === 'completed';
      const bDone = b.type === 'task' && b.task.status === 'completed';
      if (aDone !== bDone) return aDone ? 1 : -1;
      const activityA =
        a.type === 'task'
          ? taskActivityMs(project, a.task, resolveTaskIndexInProject(project, a.task))
          : contentActivityMs(a.content);
      const activityB =
        b.type === 'task'
          ? taskActivityMs(project, b.task, resolveTaskIndexInProject(project, b.task))
          : contentActivityMs(b.content);
      if (activityA !== activityB) return activityB - activityA;
      return a.type === 'task' ? -1 : 1;
    });

    return { merged, taskItems, contentInRange };
  }

  function getWeeklyCollapsedSummary(project: IProject, weekStart: Date, weekEnd: Date) {
    const { merged, taskItems, contentInRange } = getMergedItemsForProject(
      project,
      weekStart,
      weekEnd,
      {}
    );
    const displayList = merged.filter(
      (item): item is MergedCalendarItem =>
        isActiveMergedCalendarItem(item) &&
        (item.type === 'content' || taskPassesAssignmentFilter(item.task))
    );
    const activeTasks = taskItems.filter((item) => item.task.status !== 'completed');
    const openTasks = activeTasks.length;
    const totalTasks = activeTasks.length;
    const activeContent = contentInRange.filter((item) => item.status !== 'published');
    const openContent = activeContent.length;
    const totalContent = activeContent.length;
    const range = { start: weekStart, end: weekEnd };
    const hours =
      Math.round(
        (sumTaskHoursInTimeframe(project, range) +
          sumContentHoursInTimeframe(project._id.toString(), contentItems, 'weekly', range)) *
          100
      ) / 100;
    const showWeekMetrics = totalTasks > 0 || totalContent > 0 || hours > 0;
    return {
      openTasks,
      totalTasks,
      openContent,
      totalContent,
      hours,
      displayList,
      hasItemsInWeek: displayList.length > 0,
      showWeekMetrics,
    };
  }

  useEffect(() => {
    const projectIds = new Set(projects.map((p) => p._id.toString()));
    setExpandedProjects((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of prev) {
        if (!projectIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [projects]);

  const handleDateChange = (newDate: Date) => {
    setViewDate(newDate);
    if (onDateChange) {
      onDateChange(newDate);
    }
  };

  // Get date range based on timeframe
  const getDateRange = () => {
    const range = getTimeframeRange(timeframe, viewDate);
    return { start: new Date(range.start), end: new Date(range.end) };
  };

  const { start: startDate, end: endDate } = getDateRange();

  const getProjectEstimatedHours = (project: IProject): number =>
    computeProjectAssignedHours(project, contentItems);

  const navigatePeriod = (direction: 'prev' | 'next') => {
    handleDateChange(navigateCalendarPeriod(timeframe, viewDate, direction));
  };

  const goToToday = () => {
    const today = new Date();
    handleDateChange(today);
  };

  // Projects always exist in their stage view - they don't have dates themselves
  // We also want to show projects with completed tasks from previous weeks to see accomplished work
  const getProjectsForDay = (day: Date) => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    // Get the current view's date range to check for completed tasks
    const viewRange = getDateRange();
    const viewStart = new Date(viewRange.start);
    viewStart.setHours(0, 0, 0, 0);
    const viewEnd = new Date(viewRange.end);
    viewEnd.setHours(23, 59, 59, 999);

    return projects.filter(project => {
      // Projects always show in their stage view - they don't need dates
      // But we also want to include projects that have completed tasks within the view range
      // to show accomplished work from previous timeframes

      // Check if project has tasks (including completed ones) that fall within the view range
      if (project.tasks && project.tasks.length > 0) {
        const hasTaskInViewRange = project.tasks.some((task) => {
          const taskStart = parseDateSafe(task.startDate);
          const taskEnd = parseDateSafe(task.endDate);
          if (!taskStart || !taskEnd) return false;
          return taskOverlapsViewRange(viewStart, viewEnd, taskStart, taskEnd);
        });
        if (hasTaskInViewRange) return true;
      }

      // Always show projects in their stage view, even if they have no tasks
      // or if their tasks are outside the view range
      return true;
    });
  };


  const isToday = (day: Date) => {
    const today = new Date();
    return day.toDateString() === today.toDateString();
  };

  const isInViewRange = (day: Date) => {
    return day >= startDate && day <= endDate;
  };

  const viewTitle = getCalendarPeriodTitle(timeframe, viewDate);

  // Today View - One huge box showing everything for today
  const renderTodayView = () => {
    const today = new Date(startDate);
    const todayProjects = sortProjectsByLatestUpdate(getProjectsForDay(today));

    return (
      <div className="p-8 min-h-[600px]">

        {todayProjects.length === 0 ? (
          <div className="text-center py-16 text-text-secondary">
            <p className="text-lg mb-2">No projects or content scheduled for today</p>
            <p className="text-sm">Create a project or content item to get started!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {todayProjects.length > 0 && (
              <>
                <h3 className="text-xl font-semibold text-text-primary mb-4">
                  Projects ({todayProjects.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {todayProjects.map((project) => {
                    // Projects don't have dates - they just exist in their stage
                    const displayColor = project.status === 'in-review' ? '#ef4444' : project.color; // Red for in-review
                    const projectId = project._id.toString();
                    const isExpanded = expandedProjects.has(projectId);
                    const headerTextClass = getProjectCardHeaderTextClass(displayColor);

                    return (
                      <div
                        key={projectId}
                        className="p-6 rounded-lg border-2 border-border"
                        style={{
                          backgroundColor: displayColor + 'F0',
                          borderColor: displayColor,
                        }}
                      >
                        <div
                          className="flex items-start justify-between cursor-pointer"
                          onClick={() => onProjectClick(project)}
                        >
                          <h4 className={`text-xl font-bold ${headerTextClass} ${project.status === 'completed' ? 'line-through opacity-60' : ''}`}>
                            {project.name}
                          </h4>
                          <div className="flex items-center gap-2">
                            {onAddContent && canAddContentToProject(project) && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <ActionMenu
                                  align="right"
                                  width="w-36"
                                  useBackdrop
                                  items={[
                                    {
                                      label: 'Add Task',
                                      onClick: () => {
                                        if (onAddTask) onAddTask(project);
                                        else onProjectClick(project);
                                      },
                                    },
                                    {
                                      label: 'Add Content',
                                      onClick: () => onAddContent(project, today),
                                    },
                                  ]}
                                  trigger={({ toggle }) => (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggle();
                                      }}
                                      className="text-white hover:opacity-100 opacity-90 px-2 py-1 rounded border border-white/50 text-sm"
                                    >
                                      + Add
                                    </button>
                                  )}
                                />
                              </div>
                            )}
                            <span
                              className="px-3 py-1 rounded-full text-sm font-medium text-white"
                              style={{ backgroundColor: displayColor }}
                            >
                              {getProjectStatusDisplayLabel(project.status)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleProjectExpanded(projectId);
                              }}
                              className={`${headerTextClass} opacity-80 hover:opacity-100 transition-opacity`}
                              aria-label={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <>
                            {project.description && (
                              <p className="text-white opacity-90 mb-3 mt-3">{project.description}</p>
                            )}

                            <div className="space-y-2 mt-3">
                              <div className="text-sm text-white opacity-90">
                                <strong>Estimated Hours:</strong> {getProjectEstimatedHours(project)}h
                              </div>
                            </div>
                          </>
                        )}

                        {/* Unified tasks + content for today */}
                        {(() => {
                          const { merged, taskItems, contentInRange } = getMergedItemsForProject(project, today, today, {});
                          const displayList = merged.filter(
                            (item): item is MergedCalendarItem =>
                              isActiveMergedCalendarItem(item) &&
                              (item.type === 'content' || taskPassesAssignmentFilter(item.task))
                          );
                          const visible = displayList.slice(0, 5);
                          const moreCount = displayList.length - 5;
                          const hasAny = visible.length > 0 || moreCount > 0;
                          if (!hasAny) return null;
                          return (
                            <div className="mt-4">
                              <p className="text-sm font-semibold text-white mb-2">Tasks &amp; Content</p>
                              {isExpanded ? (
                                <div className="space-y-2">
                                  {visible.map((item, idx) => {
                                    if (item.type === 'task') {
                                      const task = item.task;
                                      const taskKey = `${projectId}-task-${idx}-${task.name}`;
                                      const tIdx = resolveTaskIndexInProject(project, task);
                                      return (
                                        <button
                                          key={taskKey}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (tIdx >= 0) onTaskClick?.(project, tIdx);
                                          }}
                                          className="w-full text-left p-3 rounded border border-border bg-background-card hover:bg-background-card/80 transition-colors cursor-pointer"
                                        >
                                          <div className={`font-medium text-text-primary ${(task as any).status === 'completed' ? 'line-through opacity-60' : ''}`}>
                                            <ItemSeenTag status={taskSeenStatus(project, task)} />
                                            {task.name}
                                          </div>
                                          {task.description && <p className="text-sm text-text-secondary mt-1">{task.description}</p>}
                                          <div className="flex gap-4 mt-2 text-xs text-text-secondary">
                                            {(task as any).estimatedHours && <span>{(task as any).estimatedHours}h</span>}
                                            {formatTaskAssigneeLabel(task) && (
                                              <span>Assigned: {formatTaskAssigneeLabel(task)}</span>
                                            )}
                                            <span className="capitalize">{(task as any).status}</span>
                                          </div>
                                        </button>
                                      );
                                    }
                                    const c = item.content;
                                    return (
                                      <div
                                        key={c._id.toString()}
                                        className={`p-3 rounded border border-dashed border-border bg-background-card ${c.status === 'published' ? 'opacity-60' : ''}`}
                                      >
                                        <button type="button" onClick={() => onContentItemClick?.(c)} className="text-left w-full">
                                          <span className={`font-medium text-text-primary ${c.status === 'published' ? 'line-through' : ''}`}>
                                            <ItemSeenTag status={contentSeenStatus(project, c)} />
                                            {c.title}
                                          </span>
                                          <span className="ml-2 px-2 py-0.5 rounded text-xs bg-muted text-text-secondary">{c.channel}</span>
                                        </button>
                                      </div>
                                    );
                                  })}
                                  {moreCount > 0 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onProjectClick(project);
                                      }}
                                      className="text-sm text-white underline hover:no-underline"
                                    >
                                      +{moreCount} more
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {visible.map((item, idx) => {
                                    if (item.type === 'task') {
                                      const tIdx = resolveTaskIndexInProject(project, item.task);
                                      return (
                                        <button
                                          key={`${projectId}-t-${idx}`}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (tIdx >= 0) onTaskClick?.(project, tIdx);
                                          }}
                                          className={`text-sm text-white text-left w-full min-w-0 break-words hover:underline ${(item.task as any).status === 'completed' ? 'line-through opacity-60' : ''}`}
                                          title={item.task.name}
                                        >
                                          <ItemSeenTag status={taskSeenStatus(project, item.task)} />
                                          {item.task.name}
                                        </button>
                                      );
                                    }
                                    return (
                                      <button
                                        key={item.content._id.toString()}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onContentItemClick?.(item.content);
                                        }}
                                        className={`text-sm text-white text-left w-full min-w-0 break-words hover:underline ${item.content.status === 'published' ? 'opacity-60' : ''}`}
                                        title={item.content.title}
                                      >
                                        <ItemSeenTag status={contentSeenStatus(project, item.content)} />
                                        {item.content.title}
                                        <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-white/20">{item.content.channel}</span>
                                      </button>
                                    );
                                  })}
                                  {moreCount > 0 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onProjectClick(project);
                                      }}
                                      className="text-xs text-white italic opacity-80 hover:opacity-100"
                                    >
                                      +{moreCount} more
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}


                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // Weekly View - Large daily boxes spanning 3 rows
  const renderWeeklyView = () => {
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const days: Date[] = [];
    const current = new Date(startDate);

    for (let i = 0; i < 7; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return (
      <>
        <div className="grid grid-cols-7 border-b border-border">
          {dayNames.map((day) => (
            <div
              key={day}
              className="p-3 text-center text-sm font-semibold text-text-secondary bg-background"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 divide-x divide-border relative">
          {days.map((day, dayIdx) => {
            const isCurrentDay = isToday(day);

            return (
              <div
                key={dayIdx}
                className={`p-4 min-h-[1200px] relative z-0 ${isCurrentDay ? 'bg-primary-light' : ''}`}
              >
                <div
                  className={`text-lg font-semibold mb-3 ${isCurrentDay ? 'text-primary' : 'text-text-primary'
                    }`}
                >
                  {day.getDate()}
                </div>
                <div className="space-y-2 relative" style={{ minHeight: '840px', backgroundColor: 'transparent' }}>
                  {/* Projects will be rendered as absolute positioned elements */}
                </div>
              </div>
            );
          })}
          {/* Render projects spanning across days */}
          <div className="absolute inset-0 z-10 pointer-events-none">
            <div className="relative w-full h-full pointer-events-auto">
              {(() => {
                // Get all unique projects for this week
                const weekProjects = new Map<string, IProject>();
                days.forEach(day => {
                  getProjectsForDay(day).forEach(project => {
                    weekProjects.set(project._id.toString(), project);
                  });
                });

                const allItems: Array<{ type: 'project'; project: IProject; startDate: Date; endDate: Date }> = [];

                // Add projects (sorted by latest update) - projects span the full week since they have no dates
                const weekStart = new Date(days[0]);
                weekStart.setHours(0, 0, 0, 0);
                const weekEnd = new Date(days[6]);
                weekEnd.setHours(23, 59, 59, 999);

                sortProjectsByLatestUpdate(Array.from(weekProjects.values())).forEach(project => {
                  // Projects always exist - they span the full visible timeframe
                  allItems.push({
                    type: 'project',
                    project: project,
                    startDate: weekStart,
                    endDate: weekEnd,
                  });
                });

                // Calculate positions for each item with stacking
                const itemPositions = allItems.map((item) => {
                  const itemStart = item.startDate;
                  const itemEnd = item.endDate;

                  // Find the first day in the week that overlaps with the item
                  const weekStart = new Date(days[0]);
                  weekStart.setHours(0, 0, 0, 0);
                  const weekEnd = new Date(days[6]);
                  weekEnd.setHours(23, 59, 59, 999);

                  // Item start is either the item's actual start or the week start, whichever is later
                  const displayStart = itemStart < weekStart ? weekStart : itemStart;
                  // Item end is either the item's actual end or the week end, whichever is earlier
                  const displayEnd = itemEnd > weekEnd ? weekEnd : itemEnd;

                  // Find start column (which day of the week)
                  const startCol = days.findIndex(d => {
                    const dayStart = new Date(d);
                    dayStart.setHours(0, 0, 0, 0);
                    const dayEnd = new Date(d);
                    dayEnd.setHours(23, 59, 59, 999);
                    return displayStart >= dayStart && displayStart <= dayEnd;
                  });

                  if (startCol === -1) return null;

                  // Calculate span in days
                  // Normalize dates to midnight for accurate day-only comparison
                  const startDayNormalized = new Date(displayStart);
                  startDayNormalized.setHours(0, 0, 0, 0);
                  const endDayNormalized = new Date(displayEnd);
                  endDayNormalized.setHours(0, 0, 0, 0);
                  const startDay = startDayNormalized.toDateString();
                  const endDay = endDayNormalized.toDateString();
                  // For inclusive dates: Jan 19 to Jan 20 = 2 days (19th and 20th)
                  const daysSpan = startDay === endDay ? 1 : Math.floor((endDayNormalized.getTime() - startDayNormalized.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  const span = Math.min(daysSpan, 7 - startCol);

                  return {
                    ...item,
                    startCol,
                    span,
                    displayStart,
                    displayEnd,
                  };
                }).filter((pos): pos is NonNullable<typeof pos> => pos !== null);

                // Calculate card heights first
                const cardHeights = itemPositions.map((pos) => {
                  const project = pos.project;
                  const hasTasks = project.tasks && project.tasks.length > 0;

                  let taskCount = 0;
                  if (hasTasks) {
                    taskCount = filterTasksToSeriesRepresentatives(project.tasks!, {
                      mode: 'active',
                      referenceDate: currentDate,
                    }).filter((task) => taskOverlapsWeek(task, days[0], days[6])).length;
                  }

                  // Height calculation: header (project name + status badge) + padding + tasks
                  // Match today view exactly: p-6 = 24px padding, header ~60px, each task card ~80px
                  const projectId = pos.project!._id.toString();
                  const isExpanded = expandedProjects.has(projectId);

                  const weekStart = new Date(days[0]);
                  weekStart.setHours(0, 0, 0, 0);
                  const weekEnd = new Date(days[6]);
                  weekEnd.setHours(23, 59, 59, 999);
                  const { displayList: rangeDisplayList } = getWeeklyCollapsedSummary(
                    project,
                    weekStart,
                    weekEnd
                  );
                  const unseenCount = filterUnseenItems(project, rangeDisplayList).length;

                  if (!isExpanded) {
                    return (
                      WEEKLY_HEADER_HEIGHT +
                      collapsedUnseenRowsHeight(unseenCount) +
                      16
                    );
                  }

                  // Expanded height calculation must match rendered weekly content.
                  const displayedCount = rangeDisplayList.length;
                  const descriptionHeight = project.description ? 40 : 0;
                  const tasksSectionPadding = 16; // mt-4
                  const tasksHeaderHeight = 24; // label + margin
                  const taskGapHeight = displayedCount > 0 ? (displayedCount - 1) * 8 : 0; // space-y-2
                  const listHeight = Math.min(
                    displayedCount * RANGE_ITEM_ROW_HEIGHT + taskGapHeight,
                    WEEKLY_EXPANDED_LIST_MAX_HEIGHT
                  );
                  return (
                    WEEKLY_HEADER_HEIGHT +
                    descriptionHeight +
                    tasksSectionPadding +
                    tasksHeaderHeight +
                    listHeight +
                    WEEKLY_BOTTOM_PADDING
                  );
                });

                // Calculate vertical stacking positions with variable heights
                const stackPositions: number[] = new Array(itemPositions.length).fill(0);
                const topPositions: number[] = new Array(itemPositions.length).fill(0);
                const baseTop = 60; // Base top position (increased from 60 to accommodate larger cards)

                for (let i = 0; i < itemPositions.length; i++) {
                  const current = itemPositions[i];
                  let stackLevel = 0;
                  let topPosition = baseTop;

                  // Check all previous items to see if they overlap
                  for (let j = 0; j < i; j++) {
                    const previous = itemPositions[j];
                    // Check if items overlap in time
                    if (current.displayStart <= previous.displayEnd && current.displayEnd >= previous.displayStart) {
                      // They overlap, so this item needs to be below the previous one
                      const previousBottom = topPositions[j] + cardHeights[j];
                      topPosition = Math.max(topPosition, previousBottom + 2); // 2px gap
                    }
                  }

                  stackPositions[i] = stackLevel;
                  topPositions[i] = topPosition;
                }

                return itemPositions.map((pos, idx) => {
                  const status = pos.project!.status;
                  const name = pos.project!.name;
                  const estimatedHours = getProjectEstimatedHours(pos.project!);
                  const assignedToId = (pos.project! as any).assignedToEmployeeId?.toString();
                  const assignedToName = pos.project!.assignedTo;
                  const assignedTo = getEmployeeName(assignedToId, assignedToName);

                  const cardHeight = cardHeights[idx];
                  const topPosition = topPositions[idx];

                  // Use the same color logic as today view
                  const displayColor = status === 'in-review' ? '#ef4444' : (pos.project?.color || '#3b82f6');

                  // Check if project is expanded for weekly view
                  const projectId = pos.project!._id.toString();
                  const isExpanded = expandedProjects.has(projectId);

                  return (
                    <div
                      key={`${pos.project!._id.toString()}-weekly`}
                      className={`absolute rounded-lg border-2 border-border flex flex-col overflow-hidden ${status === 'completed' ? 'line-through opacity-60' : ''}`}
                      style={{
                        backgroundColor: displayColor + 'F0',
                        borderColor: displayColor,
                        left: `calc(${pos.startCol * (100 / 7)}% + 4px)`,
                        width: `calc(${pos.span * (100 / 7)}% - 8px)`,
                        top: `${topPosition}px`,
                        height: `${cardHeight}px`,
                      }}
                      title={`${name} ${estimatedHours ? ` - ${estimatedHours}h` : ''}${assignedTo ? ` - ${assignedTo}` : ''}`}
                    >
                      {(() => {
                        const project = pos.project!;
                        const weekStart = new Date(days[0]);
                        weekStart.setHours(0, 0, 0, 0);
                        const weekEnd = new Date(days[6]);
                        weekEnd.setHours(23, 59, 59, 999);
                        const summary = getWeeklyCollapsedSummary(project, weekStart, weekEnd);
                        const headerTextClass = getProjectCardHeaderTextClass(displayColor);
                        const showMetricsSummary = !isExpanded && summary.showWeekMetrics;
                        const showEmptyWeekSummary =
                          !isExpanded &&
                          !summary.showWeekMetrics &&
                          (project.tasks?.length ?? 0) > 0;
                        const unseenItems = !isExpanded
                          ? filterUnseenItems(project, summary.displayList)
                          : [];

                        return (
                          <>
                            <div
                              className="flex items-center justify-between gap-2 min-w-0 cursor-pointer px-6 py-4 shrink-0"
                              onClick={() => onProjectClick(pos.project!)}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                                <h4
                                  className={`text-xl font-bold truncate min-w-0 ${headerTextClass} ${status === 'completed' ? 'line-through opacity-60' : ''}`}
                                >
                                  {name}
                                </h4>
                                {showMetricsSummary ? (
                                  <p className={`text-sm whitespace-nowrap truncate min-w-0 ${headerTextClass} opacity-90`}>
                                    <span>
                                      Tasks {summary.openTasks}/{summary.totalTasks}
                                    </span>
                                    <span className="mx-1.5 opacity-60" aria-hidden>
                                      ·
                                    </span>
                                    <span>
                                      Content {summary.openContent}/{summary.totalContent}
                                    </span>
                                    <span className="mx-1.5 opacity-60" aria-hidden>
                                      ·
                                    </span>
                                    <span>Hours Scheduled: {summary.hours}h</span>
                                  </p>
                                ) : null}
                                {showEmptyWeekSummary ? (
                                  <p className={`text-sm whitespace-nowrap truncate min-w-0 ${headerTextClass} opacity-90`}>
                                    <span>No tasks this week</span>
                                    <span className="mx-1.5 opacity-60" aria-hidden>
                                      ·
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTimeframeModalOpen({ project, startDate: weekStart, endDate: weekEnd });
                                      }}
                                      className="underline hover:opacity-100 opacity-90"
                                    >
                                      View all
                                    </button>
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className="px-3 py-1 rounded-full text-sm font-medium text-white"
                                  style={{ backgroundColor: displayColor }}
                                >
                                  {getProjectStatusDisplayLabel(status)}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleProjectExpanded(projectId!);
                                  }}
                                  className={`${headerTextClass} opacity-80 hover:opacity-100 transition-opacity`}
                                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                >
                                  {isExpanded ? '▼' : '▶'}
                                </button>
                              </div>
                            </div>
                            {renderCollapsedUnseenRows(
                              project,
                              unseenItems,
                              headerTextClass,
                              `${projectId}-weekly`
                            )}
                          </>
                        );
                      })()}
                      {(() => {
                        const project = pos.project!;
                        const hasTasks = (project.tasks?.length ?? 0) > 0;

                        if (!isExpanded) return null;

                        const weekStart = new Date(days[0]);
                        weekStart.setHours(0, 0, 0, 0);
                        const weekEnd = new Date(days[6]);
                        weekEnd.setHours(23, 59, 59, 999);
                        const weekSummary = getWeeklyCollapsedSummary(project, weekStart, weekEnd);
                        const visibleTasks = hasTasks
                          ? filterTasksToSeriesRepresentatives(project.tasks!, {
                              mode: 'active',
                              referenceDate: currentDate,
                            }).filter((task) => taskOverlapsWeek(task, days[0], days[6]))
                          : [];

                        return (
                          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                            {project.description && (
                              <p className="text-white opacity-90 mb-3 mt-3 px-6 shrink-0">{project.description}</p>
                            )}

                            {visibleTasks.length === 0 && hasTasks && project.tasks!.length > 0 ? (
                              <div className="mt-4 px-6 pb-6 shrink-0">
                                <p className="text-sm font-semibold text-text-primary mb-2">Tasks:</p>
                                <p className="text-sm text-text-secondary mb-2">No tasks scheduled this week.</p>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTimeframeModalOpen({ project, startDate: weekStart, endDate: weekEnd });
                                  }}
                                  className="text-sm text-primary hover:underline"
                                >
                                  View all
                                </button>
                              </div>
                            ) : weekSummary.displayList.length > 0 ? (
                              <div className="mt-4 px-6 pb-6 flex flex-col flex-1 min-h-0">
                                <p className="text-sm font-semibold text-text-primary mb-2 shrink-0">
                                  {hasTasks ? 'Tasks:' : 'Tasks & Content:'}
                                </p>
                                <div
                                  className="overflow-y-auto"
                                  style={{ maxHeight: WEEKLY_EXPANDED_LIST_MAX_HEIGHT }}
                                >
                                  {renderExpandedRangeItems(
                                    project,
                                    weekSummary.displayList,
                                    `${projectId}-weekly`
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </>
    );
  };

  // Monthly View — week panels (same chip layout as quarterly/yearly)
  const renderMonthlyView = () => {
    const firstDayOfMonth = new Date(startDate);
    const firstDay = firstDayOfMonth.getDay();
    const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
    const calendarStart = new Date(firstDayOfMonth);
    calendarStart.setDate(calendarStart.getDate() - mondayOffset);

    const lastDayOfMonth = new Date(endDate);
    const lastDay = lastDayOfMonth.getDay();
    const sundayOffset = lastDay === 0 ? 0 : 7 - lastDay;
    const calendarEnd = new Date(lastDayOfMonth);
    calendarEnd.setDate(calendarEnd.getDate() + sundayOffset);

    const days: Date[] = [];
    const current = new Date(calendarStart);
    while (current <= calendarEnd) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    const formatWeekLabel = (week: Date[]) => {
      const weekStart = week[0];
      const weekEnd = week[6];
      const startLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endLabel = weekEnd.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `Week of ${startLabel} – ${endLabel}`;
    };

    return (
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {weeks.map((week, weekIdx) => {
            const weekStart = new Date(week[0]);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(week[6]);
            weekEnd.setHours(23, 59, 59, 999);

            const weekProjects = sortProjectsByLatestUpdate(
              projects.filter((p) =>
                projectOverlapsDateRange(p, weekStart, weekEnd, contentItems)
              )
            );

            return (
              <div
                key={weekIdx}
                className="bg-background rounded-lg border border-border p-4 min-h-[300px]"
              >
                <h3 className="text-lg font-semibold text-text-primary mb-3">
                  {formatWeekLabel(week)}
                </h3>
                <div className="space-y-2">
                  {weekProjects.length === 0 ? (
                    <p className="text-sm text-text-secondary">No projects this week</p>
                  ) : (
                    weekProjects.map((project) => {
                      const projectId = project._id.toString();
                      const projectColor =
                        project.status === 'in-review' ? '#ef4444' : project.color;
                      const isExpanded = expandedProjects.has(projectId);
                      const summary = getWeeklyCollapsedSummary(project, weekStart, weekEnd);
                      const headerTextClass = getProjectCardHeaderTextClass(projectColor);
                      const hasTasks = (project.tasks?.length ?? 0) > 0;
                      const unseenItems = !isExpanded
                        ? filterUnseenItems(project, summary.displayList)
                        : [];
                      const visibleTasks = hasTasks
                        ? filterTasksToSeriesRepresentatives(project.tasks!, {
                            mode: 'active',
                            referenceDate: currentDate,
                          }).filter((task) => taskOverlapsWeek(task, week[0], week[6]))
                        : [];

                      return (
                        <div
                          key={projectId}
                          className={`rounded-lg border-2 border-border overflow-hidden ${project.status === 'completed' ? 'line-through opacity-60' : ''}`}
                          style={{
                            backgroundColor: projectColor + 'F0',
                            borderColor: projectColor,
                          }}
                        >
                          <div
                            className="flex items-center justify-between gap-2 min-w-0 cursor-pointer p-2"
                            onClick={() => onProjectClick(project)}
                          >
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <div className={`font-medium truncate ${headerTextClass}`}>
                                {project.name}
                              </div>
                              {!isExpanded && summary.showWeekMetrics ? (
                                <p className={`text-xs truncate min-w-0 ${headerTextClass} opacity-90`}>
                                  <span>
                                    Tasks {summary.openTasks}/{summary.totalTasks}
                                  </span>
                                  <span className="mx-1 opacity-60" aria-hidden>
                                    ·
                                  </span>
                                  <span>
                                    Content {summary.openContent}/{summary.totalContent}
                                  </span>
                                  <span className="mx-1 opacity-60" aria-hidden>
                                    ·
                                  </span>
                                  <span>{summary.hours}h</span>
                                </p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                                style={{ backgroundColor: projectColor }}
                              >
                                {getProjectStatusDisplayLabel(project.status)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleProjectExpanded(projectId);
                                }}
                                className={`${headerTextClass} opacity-80 hover:opacity-100 transition-opacity px-1`}
                                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                            </div>
                          </div>

                          {renderCollapsedUnseenRows(
                            project,
                            unseenItems,
                            headerTextClass,
                            `${projectId}-month-${weekIdx}`
                          )}

                          {isExpanded ? (
                            <div className="px-2 pb-2">
                              {project.description ? (
                                <p className={`text-xs mb-2 ${headerTextClass} opacity-90`}>
                                  {project.description}
                                </p>
                              ) : null}

                              {visibleTasks.length === 0 && hasTasks && project.tasks!.length > 0 ? (
                                <div className="mb-2">
                                  <p className="text-xs font-semibold text-text-primary mb-1">Tasks:</p>
                                  <p className="text-xs text-text-secondary mb-1">
                                    No tasks scheduled this week.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTimeframeModalOpen({ project, startDate: weekStart, endDate: weekEnd });
                                    }}
                                    className="text-xs text-primary hover:underline"
                                  >
                                    View all
                                  </button>
                                </div>
                              ) : summary.displayList.length > 0 ? (
                                <div
                                  className="overflow-y-auto"
                                  style={{ maxHeight: MONTHLY_EXPANDED_LIST_MAX_HEIGHT }}
                                >
                                  <p className="text-xs font-semibold text-text-primary mb-1">
                                    {hasTasks ? 'Tasks:' : 'Tasks & Content:'}
                                  </p>
                                  {renderExpandedRangeItems(
                                    project,
                                    summary.displayList,
                                    `${projectId}-month-${weekIdx}`
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Quarterly View — three month summary panels (same spirit as yearly view)
  const renderQuarterlyView = () => {
    const months: Date[][] = [];
    const quarter = Math.floor(viewDate.getMonth() / 3);

    for (let i = 0; i < 3; i++) {
      const monthDate = new Date(viewDate.getFullYear(), quarter * 3 + i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      months.push([monthStart, monthEnd]);
    }

    return (
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {months.map(([monthStart, monthEnd], idx) => {
            const monthProjects = sortProjectsByLatestUpdate(
              projects.filter((p) =>
                projectOverlapsDateRange(p, monthStart, monthEnd, contentItems)
              )
            );

            return (
              <div key={idx} className="bg-background rounded-lg border border-border p-4 min-h-[300px]">
                <h3 className="text-lg font-semibold text-text-primary mb-3">
                  {monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </h3>
                <div className="space-y-2">
                  {monthProjects.map((project) => {
                    const projectColor = project.status === 'in-review' ? '#ef4444' : project.color;
                    return (
                      <div
                        key={project._id.toString()}
                        onClick={() => onProjectClick(project)}
                        className={`text-sm p-2 rounded cursor-pointer hover:opacity-80 ${project.status === 'completed' ? 'line-through opacity-60' : ''}`}
                        style={{
                          backgroundColor: projectColor,
                          color: 'white',
                        }}
                        title={project.name}
                      >
                        <div className="font-medium truncate">{project.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Yearly View - 4 boxes per row (one for each month in a quarter)
  const renderYearlyView = () => {
    const months: Date[][] = [];

    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(viewDate.getFullYear(), i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      months.push([monthStart, monthEnd]);
    }

    return (
      <div className="p-4">
        <div className="grid grid-cols-4 gap-4">
          {months.map(([monthStart, monthEnd], idx) => {
            // Get all projects - projects always exist in their stage without date filtering
            const monthProjects = projects;

            return (
              <div
                key={idx}
                className="bg-background rounded-lg border border-border p-4 min-h-[300px]"
              >
                <h3 className="text-lg font-semibold text-text-primary mb-3">
                  {monthStart.toLocaleDateString('en-US', { month: 'short' })}
                </h3>
                <div className="space-y-2">
                  {/* Projects */}
                  {monthProjects.map((project) => {
                    const projectColor = project.status === 'in-review' ? '#ef4444' : project.color;
                    return (
                      <div
                        key={project._id.toString()}
                        onClick={() => onProjectClick(project)}
                        className={`text-sm p-2 rounded cursor-pointer hover:opacity-80 ${project.status === 'completed' ? 'line-through opacity-60' : ''}`}
                        style={{
                          backgroundColor: projectColor,
                          color: 'white',
                        }}
                        title={project.name}
                      >
                        <div className="font-medium truncate">{project.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-background-card rounded-lg border border-border overflow-x-auto overflow-y-visible">
      {/* Calendar Header with Navigation */}
      <div className="p-4 border-b border-border">
        <CalendarPeriodHeader
          title={viewTitle}
          onPrev={() => navigatePeriod('prev')}
          onNext={() => navigatePeriod('next')}
        />
      </div>

      {/* Calendar Content */}
      {timeframe === 'today' && renderTodayView()}
      {timeframe === 'weekly' && renderWeeklyView()}
      {timeframe === 'monthly' && renderMonthlyView()}
      {timeframe === 'quarterly' && renderQuarterlyView()}
      {timeframe === 'yearly' && renderYearlyView()}

      <ProjectTimeframeItemsModal
        isOpen={!!timeframeModalOpen}
        onClose={() => setTimeframeModalOpen(null)}
        project={timeframeModalOpen?.project ?? null}
        startDate={timeframeModalOpen?.startDate ?? new Date()}
        endDate={timeframeModalOpen?.endDate ?? new Date()}
        tasks={timeframeModalOpen ? getMergedItemsForProject(timeframeModalOpen.project, timeframeModalOpen.startDate, timeframeModalOpen.endDate, {}).taskItems : []}
        contentItems={timeframeModalOpen ? getMergedItemsForProject(timeframeModalOpen.project, timeframeModalOpen.startDate, timeframeModalOpen.endDate, {}).contentInRange : []}
        onContentItemClick={(item) => { onContentItemClick?.(item); setTimeframeModalOpen(null); }}
        onTaskClick={(task) => {
          if (!timeframeModalOpen) return;
          const tIdx = resolveTaskIndexInProject(timeframeModalOpen.project, task);
          setTimeframeModalOpen(null);
          if (tIdx >= 0) onTaskClick?.(timeframeModalOpen.project, tIdx);
        }}
        getEmployeeName={getEmployeeName}
      />
    </div>
  );
}
