import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    const observed = observeItemsForUser(currentUserId, workspaceItemEntries, {
      openProjectId: inspectorProjectId ?? undefined,
    });
    setItemActivityByKey(observed.activityByKey);
    setItemStatusByKey(observed.statusByKey);
  }, [currentUserId, workspaceItemEntries, inspectorProjectId]);

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

  // Auto-expand projects that have unseen task/content items
  useEffect(() => {
    if (!currentUserId || projects.length === 0) return;

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

    const toExpand: string[] = [];
    for (const project of projects) {
      const projectId = project._id.toString();
      if (manuallyCollapsed.has(projectId)) continue;
      if (countProjectUnseen(project) > 0) {
        toExpand.push(projectId);
      }
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
  }, [projects, currentUserId, itemStatusByKey, countProjectUnseen]);

  // Helper function to get employee name from ID or return the name if available
  const getEmployeeName = (assignedToId: string | undefined, assignedToName: string | undefined): string | undefined =>
    resolveEmployeeName(employees, assignedToId, assignedToName);

  const getLocalTouchMs = useCallback(
    (project: IProject): number => projectLocalTouchMs[project._id.toString()] ?? 0,
    [projectLocalTouchMs]
  );

  // Sort projects: locally-touched-by-you first, then unseen, then latest activity
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
