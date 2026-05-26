'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import type { MeetingDetailPayload } from '@/lib/scheduling/buildMeetingDetailPayload';
import { getJoinPlatformLabel } from '@/lib/scheduling/extractMeetingJoinUrl';
import { getProjectStatusDisplayLabel } from '@/lib/utils/statusMapping';

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

export default function MeetingDetailView({ token, popout = false }: MeetingDetailViewProps) {
  const [data, setData] = useState<AgendaApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/scheduling/agenda/${token}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to load meeting');
        setData(null);
      } else {
        setData(json);
        setError(null);
      }
    } catch {
      setError('Failed to load meeting');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const detail = data?.detail;
  const meeting = data?.meeting;

  const joinLabel = useMemo(() => {
    if (!detail?.meeting.joinUrl) return null;
    const platform = detail.meeting.joinPlatform;
    const label = getJoinPlatformLabel(platform);
    return label === 'Join Call' ? 'Join Call' : `Join Call — ${label}`;
  }, [detail?.meeting.joinPlatform, detail?.meeting.joinUrl]);

  const toggleProject = (projectId: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const shellClass = popout
    ? 'min-h-screen bg-background text-text-primary'
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

  return (
    <div className={`${shellClass} ${popout ? 'px-4 py-4' : 'px-4 sm:px-6 lg:px-[100px] py-8'}`}>
      <div className={popout ? 'max-w-4xl mx-auto space-y-4' : 'max-w-3xl mx-auto space-y-6'}>
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
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {detail.meeting.joinUrl && joinLabel && (
              <a
                href={detail.meeting.joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex"
              >
                <Button type="button" size="sm">
                  {joinLabel}
                </Button>
              </a>
            )}
            {popout && (
              <Link
                href={`/scheduling/agenda/${token}`}
                className="text-xs text-primary hover:text-primary-hover"
              >
                Full agenda
              </Link>
            )}
          </div>
        </header>

        {detail.projects.length === 0 ? (
          <div className={`${cardClass} p-4 text-sm ${popout ? 'text-text-secondary' : 'text-gray-400'}`}>
            <p>No linked projects for this meeting yet.</p>
            <p className="mt-2">
              Link projects from{' '}
              <Link href="/workspace?phase=Schedule" className="text-primary hover:underline">
                Schedule
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {detail.projects.map((block) => {
              const expanded = popout ? !collapsedProjects.has(block.projectId) : true;
              const { resources } = block;

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
                    <span
                      className={`text-xs shrink-0 ${popout ? 'text-text-muted' : 'text-gray-500'}`}
                    >
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
                      } space-y-3`}
                    >
                      <div className="flex flex-wrap gap-2 pt-3">
                        <Link href={resources.workspaceHref}>
                          <Button type="button" size="sm" variant="secondary">
                            Open in workspace
                          </Button>
                        </Link>
                        {resources.devUrl && (
                          <a href={resources.devUrl} target="_blank" rel="noopener noreferrer">
                            <Button type="button" size="sm" variant="secondary">
                              Dev
                            </Button>
                          </a>
                        )}
                        {resources.liveUrl && (
                          <a href={resources.liveUrl} target="_blank" rel="noopener noreferrer">
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
                          {resources.urls.map((url) => (
                            <li key={url}>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary-hover break-all"
                              >
                                {url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}

                      {resources.actionButtons.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {resources.actionButtons.map((btn) => (
                            <a
                              key={`${btn.label}-${btn.url}`}
                              href={btn.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button type="button" size="sm" variant="secondary">
                                {btn.label}
                              </Button>
                            </a>
                          ))}
                        </div>
                      )}

                      {block.assets.length > 0 && (
                        <div>
                          <p
                            className={`text-xs uppercase tracking-wide mb-1.5 ${
                              popout ? 'text-text-muted' : 'text-gray-500'
                            }`}
                          >
                            Assets
                          </p>
                          <ul className="space-y-1">
                            {block.assets.map((asset) => (
                              <li key={asset.id}>
                                <a
                                  href={asset.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-primary hover:text-primary-hover"
                                >
                                  {asset.name}
                                </a>
                                <span
                                  className={`ml-2 text-xs ${
                                    popout ? 'text-text-muted' : 'text-gray-500'
                                  }`}
                                >
                                  {asset.type}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {block.tasks.length > 0 && (
                        <div>
                          <p
                            className={`text-xs uppercase tracking-wide mb-1.5 ${
                              popout ? 'text-text-muted' : 'text-gray-500'
                            }`}
                          >
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
                                <span
                                  className={`text-xs shrink-0 ${
                                    popout ? 'text-text-muted' : 'text-gray-500'
                                  }`}
                                >
                                  {task.status || 'active'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {block.tasks.length === 0 && block.assets.length === 0 && (
                        <p className={`text-sm ${popout ? 'text-text-muted' : 'text-gray-500'}`}>
                          No tasks in this meeting window.
                        </p>
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
