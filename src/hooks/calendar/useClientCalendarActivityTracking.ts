import { useEffect, useMemo, useState } from 'react';
import { IClient } from '@/lib/models/Client';
import { IProject } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import {
  collectWorkspaceItemObservations,
  observeItemsForUser,
  readObservedItemsForUser,
  type ItemSeenStatus,
} from '@/lib/workspace/itemSeenState';

interface UseClientCalendarActivityTrackingOptions {
  clients: IClient[];
  allProjects: IProject[];
  contentItems: IContentItem[];
  currentUserId?: string | null;
  inspectorProjectId?: string | null;
  itemSeenRefreshTrigger?: number;
}

/** Tracks per-item seen/activity state and expanded-client persistence for ClientCalendarView. */
export function useClientCalendarActivityTracking({
  clients,
  allProjects,
  contentItems,
  currentUserId = null,
  inspectorProjectId = null,
  itemSeenRefreshTrigger,
}: UseClientCalendarActivityTrackingOptions) {
  const [expandedClients, setExpandedClients] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    const saved = localStorage.getItem('calendar-expanded-clients');
    if (saved) {
      try {
        return new Set(JSON.parse(saved) as string[]);
      } catch {
        return new Set();
      }
    }
    return new Set();
  });
  const [itemStatusByKey, setItemStatusByKey] = useState<Record<string, ItemSeenStatus>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(
      'calendar-expanded-clients',
      JSON.stringify(Array.from(expandedClients))
    );
  }, [expandedClients]);

  const clientIds = useMemo(() => new Set(clients.map((c) => String(c._id))), [clients]);

  const clientByProjectId = useMemo(() => {
    const clientMap = new Map(clients.map((c) => [String(c._id), c]));
    const map = new Map<string, IClient>();
    for (const project of allProjects) {
      const clientId = project.clientId?.toString();
      if (clientId && clientMap.has(clientId)) {
        map.set(String(project._id), clientMap.get(clientId)!);
      }
    }
    return map;
  }, [clients, allProjects]);

  const clientScopedProjects = useMemo(
    () => allProjects.filter((p) => p.clientId && clientIds.has(String(p.clientId))),
    [allProjects, clientIds]
  );

  const workspaceItemEntries = useMemo(
    () => collectWorkspaceItemObservations(clientScopedProjects, contentItems),
    [clientScopedProjects, contentItems]
  );

  useEffect(() => {
    if (!currentUserId) return;
    const observed = observeItemsForUser(currentUserId, workspaceItemEntries, {
      openProjectId: inspectorProjectId ?? undefined,
    });
    setItemStatusByKey(observed.statusByKey);
  }, [currentUserId, workspaceItemEntries, inspectorProjectId]);

  useEffect(() => {
    if (!currentUserId || (itemSeenRefreshTrigger ?? 0) <= 0) return;
    const keys = workspaceItemEntries.map((entry) => entry.key);
    const observed = readObservedItemsForUser(currentUserId, keys);
    setItemStatusByKey(observed.statusByKey);
  }, [currentUserId, itemSeenRefreshTrigger, workspaceItemEntries]);

  const unseenCountByClientId = useMemo(() => {
    const map = new Map<string, number>();
    for (const project of clientScopedProjects) {
      const clientId = project.clientId?.toString();
      if (!clientId) continue;
      const projectId = project._id.toString();
      let count = map.get(clientId) ?? 0;
      for (const [key, status] of Object.entries(itemStatusByKey)) {
        if (status === 'none') continue;
        if (key.startsWith(`task:${projectId}:`) || key.startsWith(`content:${projectId}:`)) {
          count += 1;
        }
      }
      map.set(clientId, count);
    }
    return map;
  }, [clientScopedProjects, itemStatusByKey]);

  const toggleClientExpanded = (clientId: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('calendar-manually-collapsed-clients');
          const manuallyCollapsed = saved ? new Set(JSON.parse(saved) as string[]) : new Set<string>();
          manuallyCollapsed.add(clientId);
          let ids = Array.from(manuallyCollapsed);
          if (ids.length > 200) ids = ids.slice(ids.length - 200);
          localStorage.setItem(
            'calendar-manually-collapsed-clients',
            JSON.stringify(ids)
          );
        }
      } else {
        next.add(clientId);
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('calendar-manually-collapsed-clients');
          if (saved) {
            const manuallyCollapsed = new Set(JSON.parse(saved) as string[]);
            manuallyCollapsed.delete(clientId);
            localStorage.setItem(
              'calendar-manually-collapsed-clients',
              JSON.stringify(Array.from(manuallyCollapsed))
            );
          }
        }
      }
      return next;
    });
  };

  useEffect(() => {
    const ids = new Set(clients.map((c) => String(c._id)));
    setExpandedClients((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of prev) {
        if (!ids.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [clients]);

  return {
    expandedClients,
    setExpandedClients,
    itemStatusByKey,
    clientIds,
    clientByProjectId,
    clientScopedProjects,
    unseenCountByClientId,
    toggleClientExpanded,
  };
}
