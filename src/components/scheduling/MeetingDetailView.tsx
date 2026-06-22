'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import CommentThread from '@/components/comments/CommentThread';
import MeetingJoinCallButton from '@/components/scheduling/MeetingJoinCallButton';
import MeetingProjectInsights from '@/components/scheduling/MeetingProjectInsights';
import type {
  MeetingDetailAsset,
  MeetingDetailContentItem,
  MeetingDetailPayload,
  MeetingDetailTaskItem,
} from '@/lib/scheduling/buildMeetingDetailPayload';
import {
  ASSET_POPUP_BLOCKED_MESSAGE,
  openAssetPopout,
} from '@/lib/scheduling/openMeetingPopout';
import { normalizeProjectUrlHref } from '@/lib/utils/projectUrls';
import { getProjectStatusDisplayLabel } from '@/lib/utils/statusMapping';

const COMMENT_POLL_MS = 15_000;

type AgendaApiResponse = {
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

interface MeetingDetailViewProps {
  token: string;
  popout?: boolean;
}

function formatMeetingRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleString()} – ${e.toLocaleString()}`;
}

type ProjectWorkTab = 'tasks' | 'content';

function isTaskCompleted(status?: string): boolean {
  return status === 'completed';
}

function isContentPublished(status?: string): boolean {
  return status === 'published';
}

function orderWithCompletedLast<T>(items: T[], isDone: (item: T) => boolean): T[] {
  return [...items.filter((item) => !isDone(item)), ...items.filter((item) => isDone(item))];
}

function collapsedProjectsForDetail(projects: MeetingDetailPayload['projects']): Set<string> {
  return new Set(
    projects
      .filter((block) => block.tasks.length === 0 && block.contentItems.length === 0)
      .map((block) => block.projectId)
  );
}

export default function MeetingDetailView({ token, popout = false }: MeetingDetailViewProps) {
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

  const toggleProject = (projectId: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const toggleTask = (key: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleContent = (key: string) => {
    setExpandedContent((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const inviteeSummary = useMemo(() => {
    if (!detail?.invitees) return null;
    const { employees, externalEmails } = detail.invitees;
    if (employees.length === 0 && externalEmails.length === 0) return null;
    return { employees, externalEmails };
  }, [detail?.invitees]);

  const handleAssetClick = (asset: MeetingDetailAsset) => {
    if (asset.openMode === 'external') return;
    const result = openAssetPopout(asset.id);
    if (result.blocked) {
      setAssetPopupMessage(ASSET_POPUP_BLOCKED_MESSAGE);
    }
  };

  const handleAddTask = async (projectId: string) => {
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
  };

  const handleAddContent = async (projectId: string) => {
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
  };

  const shellClass = popout
    ? 'h-dvh overflow-y-auto overscroll-contain bg-background text-text-primary'
    : 'min-h-screen bg-gray-900 text-white';

  const cardClass = popout
    ? 'rounded-lg border border-border bg-background-card overflow-hidden'
    : 'rounded-lg border border-gray-700 bg-gray-800/60 overflow-hidden';

  if (loading) {
    return (
      <div className={`${shellClass} flex items-center justify-center px-6 py-16`}>
        <p className={popout ? 'text-text-muted' : 'text-gray-400'}>Loading meeting…</p>
      </div>
    );
  }

  if (error || !meeting || !detail) {
    return (
      <div className={`${shellClass} px-6 py-16 text-center`}>
        <p className="text-red-400 mb-4">{error || 'Meeting not found'}</p>
        <Link
          href="/workspace?phase=Schedule"
          className="text-primary hover:underline text-sm"
        >
          Back to scheduling
        </Link>
      </div>
    );
  }

  const renderAssetList = (
    assets: MeetingDetailAsset[],
    mutedClass: string
  ) => {
    if (assets.length === 0) return null;
    return (
      <ul className="space-y-1 mt-1.5">
        {assets.map((asset) => (
          <li key={asset.id}>
            {asset.openMode === 'external' ? (
              <a
                href={asset.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:text-primary-hover"
              >
                {asset.name}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => handleAssetClick(asset)}
                className="text-sm text-primary hover:text-primary-hover text-left"
              >
                {asset.name}
              </button>
            )}
            <span className={`ml-2 text-xs ${mutedClass}`}>{asset.type}</span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className={`${shellClass} ${popout ? 'px-4 py-4' : 'px-4 sm:px-6 lg:px-[100px] py-8'}`}>
      <div className={popout ? 'max-w-4xl mx-auto space-y-4' : 'max-w-3xl mx-auto space-y-6'}>
        {assetPopupMessage && (
          <div className="rounded-lg border border-border bg-background-card px-4 py-2 text-sm text-text-secondary flex items-center justify-between gap-2">
            <span>{assetPopupMessage}</span>
            <button
              type="button"
              className="text-text-muted hover:text-text-primary text-xs shrink-0"
              onClick={() => setAssetPopupMessage(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            {!popout && (
              <div className="flex flex-wrap gap-3 mb-2">
                <Link
                  href="/workspace?lens=agenda"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  ← Workspace agenda
                </Link>
                <Link
                  href="/workspace?phase=Schedule"
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Scheduling
                </Link>
              </div>
            )}
            <h1 className={`font-bold ${popout ? 'text-xl' : 'text-2xl'}`}>{meeting.title}</h1>
            <p className={`mt-1 text-sm ${popout ? 'text-text-muted' : 'text-gray-400'}`}>
              {formatMeetingRange(meeting.start, meeting.end)}
            </p>
            {popout && inviteeSummary && (
              <div className={`mt-3 text-sm ${popout ? 'text-text-secondary' : 'text-gray-400'}`}>
                <p className="text-xs uppercase tracking-wide text-text-muted mb-1">Invitees</p>
                {inviteeSummary.employees.length > 0 && (
                  <p>{inviteeSummary.employees.map((e) => e.name).join(', ')}</p>
                )}
                {inviteeSummary.externalEmails.length > 0 && (
                  <p className="text-xs text-text-muted mt-0.5">
                    Guests: {inviteeSummary.externalEmails.join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {detail.meeting.joinUrl && (
              <MeetingJoinCallButton
                joinUrl={detail.meeting.joinUrl}
                joinPlatform={detail.meeting.joinPlatform}
                agendaToken={popout ? undefined : token}
              />
            )}
          </div>
        </header>

        {detail.projects.length === 0 ? (
          <div className={`${cardClass} p-4 text-sm ${popout ? 'text-text-secondary' : 'text-gray-400'}`}>
            <p>No linked projects for this meeting yet.</p>
            {!popout && (
              <p className="mt-2">
                Link projects from{' '}
                <Link href="/workspace?phase=Schedule" className="text-primary hover:underline">
                  Schedule
                </Link>
                .
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {detail.projects.map((block) => {
              const expanded = popout ? !collapsedProjects.has(block.projectId) : true;
              const { resources } = block;
              const mutedClass = popout ? 'text-text-muted' : 'text-gray-500';
              const canContribute = !!canContributeByProjectId[block.projectId];

              return (
                <section key={block.projectId} className={cardClass}>
                  <button
                    type="button"
                    onClick={() => popout && toggleProject(block.projectId)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left ${
                      popout ? 'hover:bg-background-elevated/50' : ''
                    }`}
                    disabled={!popout}
                  >
                    {block.color && (
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: block.color }}
                      />
                    )}
                    <span className="font-semibold flex-1">{block.name}</span>
                    <span className={`text-xs shrink-0 ${mutedClass}`}>
                      {getProjectStatusDisplayLabel(resources.status)}
                    </span>
                    {popout && (
                      <span className="text-text-muted text-xs">
                        {expanded ? '▼' : '▶'}
                      </span>
                    )}
                  </button>

                  {expanded && (
                    <div
                      className={`px-4 pb-4 border-t ${
                        popout ? 'border-border' : 'border-gray-700'
                      } space-y-4`}
                    >
                      {popout ? (
                        <>
                          <MeetingProjectInsights resources={resources} />

                          <div>
                            <p className={`text-xs uppercase tracking-wide mb-2 ${mutedClass}`}>
                              Project comments
                            </p>
                            <CommentThread
                              entityType="project"
                              entityId={block.projectId}
                              showHeading={false}
                              pollIntervalMs={COMMENT_POLL_MS}
                            />
                          </div>

                          {(() => {
                            const activeTab = projectWorkTab[block.projectId] ?? 'tasks';
                            const orderedTasks = orderWithCompletedLast<MeetingDetailTaskItem>(
                              block.tasks,
                              (task) => isTaskCompleted(task.status)
                            );
                            const orderedContent = orderWithCompletedLast<MeetingDetailContentItem>(
                              block.contentItems,
                              (item) => isContentPublished(item.status)
                            );

                            const renderTaskRow = (task: MeetingDetailTaskItem) => {
                              const taskKey = `${block.projectId}-${task.taskId}`;
                              const open = expandedTasks.has(taskKey);
                              const done = isTaskCompleted(task.status);
                              return (
                                <li
                                  key={taskKey}
                                  className={`rounded border border-border bg-background-elevated/40 ${
                                    done ? 'opacity-60' : ''
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleTask(taskKey)}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left"
                                  >
                                    <span className={done ? 'line-through' : ''}>{task.name}</span>
                                    <span className={`text-xs shrink-0 ${mutedClass}`}>
                                      {task.status || 'active'} {open ? '▼' : '▶'}
                                    </span>
                                  </button>
                                  {task.assets.length > 0 && (
                                    <div className="px-3 pb-2">
                                      <p className={`text-xs ${mutedClass}`}>Assets</p>
                                      {renderAssetList(task.assets, mutedClass)}
                                    </div>
                                  )}
                                  {open && (
                                    <div className="px-3 pb-3 border-t border-border">
                                      <CommentThread
                                        entityType="projectTask"
                                        entityId={block.projectId}
                                        taskIndex={task.taskIndex}
                                        taskId={task.taskId}
                                        showHeading={false}
                                        pollIntervalMs={COMMENT_POLL_MS}
                                      />
                                    </div>
                                  )}
                                </li>
                              );
                            };

                            const renderContentRow = (item: MeetingDetailContentItem) => {
                              const contentKey = `${block.projectId}-${item.contentItemId}`;
                              const open = expandedContent.has(contentKey);
                              const done = isContentPublished(item.status);
                              return (
                                <li
                                  key={contentKey}
                                  className={`rounded border border-border bg-background-elevated/40 ${
                                    done ? 'opacity-60' : ''
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleContent(contentKey)}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left"
                                  >
                                    <span className={done ? 'line-through' : ''}>{item.title}</span>
                                    <span className={`text-xs shrink-0 ${mutedClass}`}>
                                      {item.channel || 'Content'} {open ? '▼' : '▶'}
                                    </span>
                                  </button>
                                  {item.assets.length > 0 && (
                                    <div className="px-3 pb-2">
                                      <p className={`text-xs ${mutedClass}`}>Assets</p>
                                      {renderAssetList(item.assets, mutedClass)}
                                    </div>
                                  )}
                                  {open && (
                                    <div className="px-3 pb-3 border-t border-border">
                                      <CommentThread
                                        entityType="contentItem"
                                        entityId={item.contentItemId}
                                        showHeading={false}
                                        pollIntervalMs={COMMENT_POLL_MS}
                                      />
                                    </div>
                                  )}
                                </li>
                              );
                            };

                            return (
                              <div>
                                <div className="flex flex-wrap items-center gap-2 border-b border-border mb-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setProjectWorkTab((prev) => ({
                                        ...prev,
                                        [block.projectId]: 'tasks',
                                      }))
                                    }
                                    className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                      activeTab === 'tasks'
                                        ? 'border-primary text-text-primary'
                                        : 'border-transparent text-text-muted hover:text-text-secondary'
                                    }`}
                                  >
                                    Tasks
                                    {orderedTasks.length > 0 && (
                                      <span className="ml-1.5 text-xs text-text-muted">
                                        ({orderedTasks.length})
                                      </span>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setProjectWorkTab((prev) => ({
                                        ...prev,
                                        [block.projectId]: 'content',
                                      }))
                                    }
                                    className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                      activeTab === 'content'
                                        ? 'border-primary text-text-primary'
                                        : 'border-transparent text-text-muted hover:text-text-secondary'
                                    }`}
                                  >
                                    Content
                                    {orderedContent.length > 0 && (
                                      <span className="ml-1.5 text-xs text-text-muted">
                                        ({orderedContent.length})
                                      </span>
                                    )}
                                  </button>
                                  {canContribute && activeTab === 'tasks' && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="ml-auto"
                                      onClick={() => {
                                        setAddContentOpenFor(null);
                                        setAddTaskOpenFor(
                                          addTaskOpenFor === block.projectId ? null : block.projectId
                                        );
                                      }}
                                    >
                                      + Add Task
                                    </Button>
                                  )}
                                  {canContribute && activeTab === 'content' && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="ml-auto"
                                      onClick={() => {
                                        setAddTaskOpenFor(null);
                                        setAddContentOpenFor(
                                          addContentOpenFor === block.projectId
                                            ? null
                                            : block.projectId
                                        );
                                      }}
                                    >
                                      + Add Content
                                    </Button>
                                  )}
                                </div>

                                {activeTab === 'tasks' && addTaskOpenFor === block.projectId && (
                                  <div className="mb-3 flex flex-wrap items-center gap-2">
                                    <input
                                      type="text"
                                      value={taskDrafts[block.projectId] ?? ''}
                                      onChange={(e) =>
                                        setTaskDrafts((prev) => ({
                                          ...prev,
                                          [block.projectId]: e.target.value,
                                        }))
                                      }
                                      placeholder="Task name"
                                      className="flex-1 min-w-[12rem] px-3 py-1.5 text-sm border border-border rounded-md bg-background"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') void handleAddTask(block.projectId);
                                      }}
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={
                                        savingProjectId === block.projectId ||
                                        !(taskDrafts[block.projectId] ?? '').trim()
                                      }
                                      onClick={() => void handleAddTask(block.projectId)}
                                    >
                                      Add
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => setAddTaskOpenFor(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                )}

                                {activeTab === 'content' && addContentOpenFor === block.projectId && (
                                  <div className="mb-3 flex flex-wrap items-center gap-2">
                                    <input
                                      type="text"
                                      value={contentDrafts[block.projectId] ?? ''}
                                      onChange={(e) =>
                                        setContentDrafts((prev) => ({
                                          ...prev,
                                          [block.projectId]: e.target.value,
                                        }))
                                      }
                                      placeholder="Content title"
                                      className="flex-1 min-w-[12rem] px-3 py-1.5 text-sm border border-border rounded-md bg-background"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') void handleAddContent(block.projectId);
                                      }}
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={
                                        savingProjectId === block.projectId ||
                                        !(contentDrafts[block.projectId] ?? '').trim()
                                      }
                                      onClick={() => void handleAddContent(block.projectId)}
                                    >
                                      Add
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => setAddContentOpenFor(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                )}

                                {activeTab === 'tasks' ? (
                                  orderedTasks.length > 0 ? (
                                    <ul className="space-y-2">{orderedTasks.map(renderTaskRow)}</ul>
                                  ) : (
                                    <p className={`text-sm ${mutedClass}`}>
                                      No tasks in this meeting window.
                                    </p>
                                  )
                                ) : orderedContent.length > 0 ? (
                                  <ul className="space-y-2">{orderedContent.map(renderContentRow)}</ul>
                                ) : (
                                  <p className={`text-sm ${mutedClass}`}>
                                    No content in this meeting window.
                                  </p>
                                )}
                              </div>
                            );
                          })()}

                          {block.assets.length > 0 && (
                            <div>
                              <p className={`text-xs uppercase tracking-wide mb-1.5 ${mutedClass}`}>
                                Project assets
                              </p>
                              {renderAssetList(block.assets, mutedClass)}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-2 pt-3">
                            <Link href={resources.workspaceHref}>
                              <Button type="button" size="sm" variant="secondary">
                                Open in workspace
                              </Button>
                            </Link>
                            {normalizeProjectUrlHref(resources.devUrl ?? '') && (
                              <a href={normalizeProjectUrlHref(resources.devUrl ?? '')!} target="_blank" rel="noopener noreferrer">
                                <Button type="button" size="sm" variant="secondary">
                                  Dev
                                </Button>
                              </a>
                            )}
                            {normalizeProjectUrlHref(resources.liveUrl ?? '') && (
                              <a href={normalizeProjectUrlHref(resources.liveUrl ?? '')!} target="_blank" rel="noopener noreferrer">
                                <Button type="button" size="sm" variant="secondary">
                                  Live
                                </Button>
                              </a>
                            )}
                            <Link href={resources.assetsHref}>
                              <Button type="button" size="sm" variant="secondary">
                                Assets
                              </Button>
                            </Link>
                          </div>

                          {resources.urls.length > 0 && (
                            <ul className="text-xs space-y-1">
                              {resources.urls.map((url) => {
                                const href = normalizeProjectUrlHref(url);
                                if (!href) return null;
                                return (
                                  <li key={url}>
                                    <a
                                      href={href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:text-primary-hover break-all"
                                    >
                                      {url}
                                    </a>
                                  </li>
                                );
                              })}
                            </ul>
                          )}

                          {resources.actionButtons.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {resources.actionButtons.map((btn) => {
                                const href = normalizeProjectUrlHref(btn.url);
                                if (!href) return null;
                                return (
                                  <a
                                    key={`${btn.label}-${btn.url}`}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Button type="button" size="sm" variant="secondary">
                                      {btn.label}
                                    </Button>
                                  </a>
                                );
                              })}
                            </div>
                          )}

                          {block.assets.length > 0 && (
                            <div>
                              <p className={`text-xs uppercase tracking-wide mb-1.5 ${mutedClass}`}>
                                Assets
                              </p>
                              {renderAssetList(block.assets, mutedClass)}
                            </div>
                          )}

                          {block.tasks.length > 0 && (
                            <div>
                              <p className={`text-xs uppercase tracking-wide mb-1.5 ${mutedClass}`}>
                                Tasks in meeting window
                              </p>
                              <ul className="space-y-1">
                                {block.tasks.map((task) => (
                                  <li
                                    key={`${block.projectId}-${task.taskId}`}
                                    className={`text-sm flex justify-between gap-2 rounded px-2 py-1.5 ${
                                      popout ? 'bg-background-elevated/40' : 'bg-gray-900/50'
                                    }`}
                                  >
                                    <span>{task.name}</span>
                                    <span className={`text-xs shrink-0 ${mutedClass}`}>
                                      {task.status || 'active'}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
