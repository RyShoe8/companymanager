import { useCallback, useEffect, useMemo, useState } from 'react';
import { IProject, IProjectTask } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { IEmployee } from '@/lib/models/Employee';
import { isEmployeeOnProjectTeam } from '@/lib/utils/projectTeam';
import { resolveEmployeeName } from '@/lib/utils/assigneeDisplay';
import {
  buildContentItemsByProjectId,
  compareProjectsForWorkspaceSort,
  getEffectiveProjectActivityMs,
  getProjectLatestActivityMs,
} from '@/lib/utils/projectLatestActivity';
import {
  buildContentItemKey,
  buildTaskItemKey,
  collectWorkspaceItemObservations,
  type ItemSeenStatus,
  observeItemsForUser,
  readObservedItemsForUser,
} from '@/lib/workspace/itemSeenState';

const EMPTY_COMMENT_MAP = new Map<string, Date>();

interface UseCalendarActivityTrackingOptions {
  projects: IProject[];
  contentItems: IContentItem[];
  currentUserId?: string | null;
  currentUserEmployeeId?: string | null;
  isManagerOrAdmin?: boolean;
  inspectorProjectId?: string | null;
  itemSeenRefreshTrigger?: number;
  projectLocalTouchMs?: Record<string, number>;
}

function readManuallyCollapsedProjects(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  const saved = localStorage.getItem('calendar-manually-collapsed-projects');
  if (!saved) return new Set();
  try {
    return new Set(JSON.parse(saved) as string[]);
  } catch {
    return new Set();
  }
}

/** Tracks per-item seen/activity state, employee lookups, and expanded-project persistence for CalendarView. */
export function useCalendarActivityTracking({
  projects,
  contentItems,
  currentUserId,
  currentUserEmployeeId,
  isManagerOrAdmin = false,
  inspectorProjectId = null,
  itemSeenRefreshTrigger,
  projectLocalTouchMs = {},
}: UseCalendarActivityTrackingOptions) {
  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [fetchedProjectLatestComments, setFetchedProjectLatestComments] = useState<Map<string, Date>>(
    new Map()
  );
  const [itemActivityByKey, setItemActivityByKey] = useState<Record<string, number>>({});
  const [itemStatusByKey, setItemStatusByKey] = useState<Record<string, ItemSeenStatus>>({});
  const [prevActivityMs, setPrevActivityMs] = useState<Record<string, number>>({});
  const [activityInitialized, setActivityInitialized] = useState(false);

  const projectLatestComments =
    projects.length === 0 ? EMPTY_COMMENT_MAP : fetchedProjectLatestComments;

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

  const workspaceKeys = useMemo(
    () => workspaceItemEntries.map((entry) => entry.key),
    [workspaceItemEntries]
  );

  useEffect(() => {
    if (!currentUserId) return;
    const observed = observeItemsForUser(currentUserId, workspaceItemEntries, {
      openProjectId: inspectorProjectId ?? undefined,
    });
    const timer = window.setTimeout(() => {
      setItemActivityByKey((prev) =>
        JSON.stringify(prev) === JSON.stringify(observed.activityByKey) ? prev : observed.activityByKey
      );
      setItemStatusByKey((prev) =>
        JSON.stringify(prev) === JSON.stringify(observed.statusByKey) ? prev : observed.statusByKey
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentUserId, workspaceItemEntries, inspectorProjectId]);

  const refreshedObservation = useMemo(() => {
    if (!currentUserId || (itemSeenRefreshTrigger ?? 0) <= 0) return null;
    return readObservedItemsForUser(currentUserId, workspaceKeys);
  }, [currentUserId, itemSeenRefreshTrigger, workspaceKeys]);

  if (refreshedObservation) {
    if (JSON.stringify(itemActivityByKey) !== JSON.stringify(refreshedObservation.activityByKey)) {
      setItemActivityByKey(refreshedObservation.activityByKey);
    }
    if (JSON.stringify(itemStatusByKey) !== JSON.stringify(refreshedObservation.statusByKey)) {
      setItemStatusByKey(refreshedObservation.statusByKey);
    }
  }

  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('calendar-expanded-projects');
      if (saved) {
        try {
          const projectIds = JSON.parse(saved);
          return new Set(projectIds);
        } catch {
          return new Set();
        }
      }
    }
    return new Set();
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const projectIds = Array.from(expandedProjects);
      localStorage.setItem('calendar-expanded-projects', JSON.stringify(projectIds));
    }
  }, [expandedProjects]);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await fetch('/api/employees');
        if (response.ok) {
          const data = await response.json();
          setEmployees(data);
        }
      } catch {
        // Error fetching employees
      }
    };
    void fetchEmployees();
  }, []);

  const getLatestActivityMs = useCallback(
    (project: IProject): number => {
      const projectId = project._id.toString();
      const commentDate = projectLatestComments.get(projectId);
      const commentMs = commentDate ? commentDate.getTime() : undefined;
      const serverMs = getProjectLatestActivityMs(
        project,
        contentByProjectId.get(projectId) ?? [],
        commentMs
      );
      let itemMs = 0;
      const taskPrefix = `task:${projectId}:`;
      const contentPrefix = `content:${projectId}:`;
      for (const [key, ms] of Object.entries(itemActivityByKey)) {
        if (key.startsWith(taskPrefix) || key.startsWith(contentPrefix)) {
          if (ms > itemMs) itemMs = ms;
        }
      }
      return getEffectiveProjectActivityMs(
        serverMs,
        itemMs,
        projectLocalTouchMs[projectId]
      );
    },
    [contentByProjectId, projectLatestComments, itemActivityByKey, projectLocalTouchMs]
  );

  useEffect(() => {
    if (projects.length === 0) return;

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
          setFetchedProjectLatestComments(commentMap);
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

  const countProjectUnseen = useCallback(
    (project: IProject): number => {
      const projectId = project._id.toString();
      let count = 0;
      for (const [key, status] of Object.entries(itemStatusByKey)) {
        if (status === 'none') continue;
        if (key.startsWith(`task:${projectId}:`) || key.startsWith(`content:${projectId}:`)) {
          count += 1;
        }
      }
      return count;
    },
    [itemStatusByKey]
  );

  const manuallyCollapsed = useMemo(() => readManuallyCollapsedProjects(), [
    // Re-read when expansion changes (collapse tracking writes localStorage in toggle).
    expandedProjects,
  ]);

  const nextActivityMs: Record<string, number> = {};
  for (const project of projects) {
    nextActivityMs[project._id.toString()] = getLatestActivityMs(project);
  }

  const toExpandFromActivity: string[] = [];
  if (activityInitialized) {
    for (const [projectId, activityMs] of Object.entries(nextActivityMs)) {
      const prevMs = prevActivityMs[projectId];
      if (prevMs !== undefined && activityMs > prevMs && !manuallyCollapsed.has(projectId)) {
        toExpandFromActivity.push(projectId);
      }
    }
  }

  const nextActivitySerialized = JSON.stringify(nextActivityMs);
  const prevActivitySerialized = JSON.stringify(prevActivityMs);
  if (nextActivitySerialized !== prevActivitySerialized) {
    setPrevActivityMs(nextActivityMs);
    if (!activityInitialized && projects.length > 0) {
      setActivityInitialized(true);
    }
  }

  const toExpandFromUnseen: string[] = [];
  if (currentUserId && projects.length > 0) {
    for (const project of projects) {
      const projectId = project._id.toString();
      if (manuallyCollapsed.has(projectId)) continue;
      if (countProjectUnseen(project) > 0) {
        toExpandFromUnseen.push(projectId);
      }
    }
  }

  const expandIds = [...toExpandFromActivity, ...toExpandFromUnseen];
  if (expandIds.length > 0) {
    let needsExpand = false;
    for (const id of expandIds) {
      if (!expandedProjects.has(id)) {
        needsExpand = true;
        break;
      }
    }
    if (needsExpand) {
      const updated = new Set(expandedProjects);
      for (const id of expandIds) updated.add(id);
      setExpandedProjects(updated);
    }
  }

  const projectBadgeEligible = useCallback(
    (project: IProject): boolean =>
      !!currentUserEmployeeId &&
      !!isManagerOrAdmin &&
      isEmployeeOnProjectTeam(project, currentUserEmployeeId),
    [currentUserEmployeeId, isManagerOrAdmin]
  );

  const taskActivityMs = useCallback(
    (project: IProject, task: IProjectTask, idx: number) =>
      itemActivityByKey[taskKeyFor(project, task, idx)] ?? 0,
    [itemActivityByKey, taskKeyFor]
  );

  const contentActivityMs = useCallback(
    (item: IContentItem) => itemActivityByKey[contentKeyFor(item)] ?? 0,
    [itemActivityByKey, contentKeyFor]
  );

  const getEmployeeName = (assignedToId: string | undefined, assignedToName: string | undefined): string | undefined =>
    resolveEmployeeName(employees, assignedToId, assignedToName);

  const getLocalTouchMs = useCallback(
    (project: IProject): number => projectLocalTouchMs[project._id.toString()] ?? 0,
    [projectLocalTouchMs]
  );

  const sortProjectsByLatestUpdate = (projectList: IProject[]): IProject[] => {
    return [...projectList].sort((a, b) =>
      compareProjectsForWorkspaceSort(
        getLatestActivityMs(a),
        countProjectUnseen(a),
        getLatestActivityMs(b),
        countProjectUnseen(b),
        getLocalTouchMs(a),
        getLocalTouchMs(b)
      )
    );
  };

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('calendar-manually-collapsed-projects');
          const collapsed = saved ? new Set(JSON.parse(saved) as string[]) : new Set<string>();
          collapsed.add(projectId);
          let ids = Array.from(collapsed);
          if (ids.length > 200) ids = ids.slice(ids.length - 200);
          localStorage.setItem('calendar-manually-collapsed-projects', JSON.stringify(ids));
        }
      } else {
        newSet.add(projectId);
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('calendar-manually-collapsed-projects');
          if (saved) {
            const collapsed = new Set(JSON.parse(saved) as string[]);
            collapsed.delete(projectId);
            localStorage.setItem(
              'calendar-manually-collapsed-projects',
              JSON.stringify(Array.from(collapsed))
            );
          }
        }
      }
      return newSet;
    });
  };

  return {
    employees,
    contentByProjectId,
    itemActivityByKey,
    itemStatusByKey,
    taskKeyFor,
    contentKeyFor,
    taskActivityMs,
    contentActivityMs,
    projectBadgeEligible,
    expandedProjects,
    setExpandedProjects,
    getLatestActivityMs,
    countProjectUnseen,
    getEmployeeName,
    getLocalTouchMs,
    sortProjectsByLatestUpdate,
    toggleProjectExpanded,
  };
}
