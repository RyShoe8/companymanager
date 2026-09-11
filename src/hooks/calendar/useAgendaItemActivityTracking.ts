import { useCallback, useEffect, useMemo, useState } from 'react';
import { IProject, IProjectTask } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { isEmployeeOnProjectTeam } from '@/lib/utils/projectTeam';
import {
  buildContentItemKey,
  buildTaskItemKey,
  collectWorkspaceItemObservations,
  type ItemSeenStatus,
  observeItemsForUser,
  readObservedItemsForUser,
} from '@/lib/workspace/itemSeenState';

interface UseAgendaItemActivityTrackingOptions {
  projects: IProject[];
  contentItems: IContentItem[];
  currentUserId?: string | null;
  currentUserEmployeeId?: string | null;
  isManagerOrAdmin?: boolean;
  inspectorProjectId?: string | null;
  itemSeenRefreshTrigger?: number;
}

/** Tracks per-item seen/activity state for AgendaView's tasks and content. */
export function useAgendaItemActivityTracking({
  projects,
  contentItems,
  currentUserId,
  currentUserEmployeeId,
  isManagerOrAdmin = false,
  inspectorProjectId = null,
  itemSeenRefreshTrigger,
}: UseAgendaItemActivityTrackingOptions) {
  const [itemActivityByKey, setItemActivityByKey] = useState<Record<string, number>>({});
  const [itemStatusByKey, setItemStatusByKey] = useState<Record<string, ItemSeenStatus>>({});

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
    (item: IContentItem) => buildContentItemKey(item.projectId?.toString() ?? 'none', item._id.toString()),
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

  // Side-effecting localStorage observe — defer React state so the effect only schedules work.
  useEffect(() => {
    if (!currentUserId) return;
    const observed = observeItemsForUser(currentUserId, workspaceItemEntries, {
      openProjectId: inspectorProjectId ?? undefined,
    });
    const timer = window.setTimeout(() => {
      setItemActivityByKey(observed.activityByKey);
      setItemStatusByKey(observed.statusByKey);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentUserId, workspaceItemEntries, inspectorProjectId]);

  const refreshedObservation = useMemo(() => {
    if (!currentUserId || (itemSeenRefreshTrigger ?? 0) <= 0) return null;
    return readObservedItemsForUser(currentUserId, workspaceKeys);
  }, [currentUserId, itemSeenRefreshTrigger, workspaceKeys]);

  if (refreshedObservation) {
    const activityChanged =
      JSON.stringify(itemActivityByKey) !== JSON.stringify(refreshedObservation.activityByKey);
    const statusChanged =
      JSON.stringify(itemStatusByKey) !== JSON.stringify(refreshedObservation.statusByKey);
    if (activityChanged) setItemActivityByKey(refreshedObservation.activityByKey);
    if (statusChanged) setItemStatusByKey(refreshedObservation.statusByKey);
  }

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

  return {
    itemStatusByKey,
    taskKeyFor,
    contentKeyFor,
    taskActivityMs,
    contentActivityMs,
    projectBadgeEligible,
  };
}
