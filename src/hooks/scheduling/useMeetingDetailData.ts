import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  MeetingDetailAsset,
  MeetingDetailPayload,
} from '@/lib/scheduling/buildMeetingDetailPayload';
import {
  ASSET_POPUP_BLOCKED_MESSAGE,
  openAssetPopout,
} from '@/lib/scheduling/openMeetingPopout';

export type AgendaApiResponse = {
  meeting: {
    _id: string;
    title: string;
    start: string;
    end: string;
    agendaToken: string;
    joinUrl?: string;
    joinPlatform?: MeetingDetailPayload['meeting']['joinPlatform'];
  };
  canContributeByProjectId?: Record<string, boolean>;
  detail?: MeetingDetailPayload;
};

export type ProjectWorkTab = 'tasks' | 'content';

function collapsedProjectsForDetail(projects: MeetingDetailPayload['projects']): Set<string> {
  return new Set(
    projects
      .filter((block) => block.tasks.length === 0 && block.contentItems.length === 0)
      .map((block) => block.projectId)
  );
}

/** Loads a meeting's agenda payload and manages all view/edit state for MeetingDetailView. */
export function useMeetingDetailData(token: string, popout: boolean) {
  const [data, setData] = useState<AgendaApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [expandedContent, setExpandedContent] = useState<Set<string>>(new Set());
  const [projectWorkTab, setProjectWorkTab] = useState<Record<string, ProjectWorkTab>>({});
  const [addTaskOpenFor, setAddTaskOpenFor] = useState<string | null>(null);
  const [addContentOpenFor, setAddContentOpenFor] = useState<string | null>(null);
  const [taskDrafts, setTaskDrafts] = useState<Record<string, string>>({});
  const [contentDrafts, setContentDrafts] = useState<Record<string, string>>({});
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);
  const [assetPopupMessage, setAssetPopupMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/scheduling/agenda/${token}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to load meeting');
        setData(null);
      } else {
        setData(json);
        setError(null);
        if (popout && json.detail?.projects) {
          setCollapsedProjects(collapsedProjectsForDetail(json.detail.projects));
        }
      }
    } catch {
      setError('Failed to load meeting');
    } finally {
      setLoading(false);
    }
  }, [token, popout]);

  useEffect(() => {
    void load();
  }, [load]);

  const detail = data?.detail;
  const meeting = data?.meeting;
  const canContributeByProjectId = data?.canContributeByProjectId ?? {};

  const toggleProject = useCallback((projectId: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }, []);

  const toggleTask = useCallback((key: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleContent = useCallback((key: string) => {
    setExpandedContent((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const inviteeSummary = useMemo(() => {
    if (!detail?.invitees) return null;
    const { employees, externalEmails } = detail.invitees;
    if (employees.length === 0 && externalEmails.length === 0) return null;
    return { employees, externalEmails };
  }, [detail?.invitees]);

  const handleAssetClick = useCallback((asset: MeetingDetailAsset) => {
    if (asset.openMode === 'external') return;
    const result = openAssetPopout(asset.id);
    if (result.blocked) {
      setAssetPopupMessage(ASSET_POPUP_BLOCKED_MESSAGE);
    }
  }, []);

  const handleAddTask = useCallback(
    async (projectId: string) => {
      if (!meeting) return;
      const name = (taskDrafts[projectId] ?? '').trim();
      if (!name) return;
      setSavingProjectId(projectId);
      try {
        const res = await fetch(`/api/projects/${projectId}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task: {
              name,
              startDate: meeting.start,
              endDate: meeting.end,
            },
          }),
        });
        if (res.ok) {
          setTaskDrafts((prev) => ({ ...prev, [projectId]: '' }));
          setAddTaskOpenFor(null);
          await load();
        }
      } finally {
        setSavingProjectId(null);
      }
    },
    [meeting, taskDrafts, load]
  );

  const handleAddContent = useCallback(
    async (projectId: string) => {
      if (!meeting) return;
      const title = (contentDrafts[projectId] ?? '').trim();
      if (!title) return;
      setSavingProjectId(projectId);
      try {
        const publishDate = new Date(meeting.start);
        publishDate.setHours(12, 0, 0, 0);
        const res = await fetch('/api/content-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            title,
            publishDate: publishDate.toISOString(),
            status: 'planned',
          }),
        });
        if (res.ok) {
          setContentDrafts((prev) => ({ ...prev, [projectId]: '' }));
          setAddContentOpenFor(null);
          await load();
        }
      } finally {
        setSavingProjectId(null);
      }
    },
    [meeting, contentDrafts, load]
  );

  return {
    data,
    error,
    loading,
    detail,
    meeting,
    canContributeByProjectId,
    collapsedProjects,
    toggleProject,
    expandedTasks,
    toggleTask,
    expandedContent,
    toggleContent,
    projectWorkTab,
    setProjectWorkTab,
    addTaskOpenFor,
    setAddTaskOpenFor,
    addContentOpenFor,
    setAddContentOpenFor,
    taskDrafts,
    setTaskDrafts,
    contentDrafts,
    setContentDrafts,
    savingProjectId,
    assetPopupMessage,
    setAssetPopupMessage,
    inviteeSummary,
    handleAssetClick,
    handleAddTask,
    handleAddContent,
  };
}
