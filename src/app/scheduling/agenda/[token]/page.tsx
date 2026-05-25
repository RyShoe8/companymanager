'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import CommentThread from '@/components/comments/CommentThread';
import type { MeetingAgendaPayload } from '@/lib/scheduling/buildMeetingAgenda';

const COMMENT_POLL_MS = 15_000;

type AgendaResponse = {
  meeting: {
    _id: string;
    title: string;
    start: string;
    end: string;
    agendaToken: string;
    linkedProjectIds: string[];
  };
  agenda: MeetingAgendaPayload;
};

function AgendaContent() {
  const params = useParams();
  const token = typeof params.token === 'string' ? params.token : '';
  const [data, setData] = useState<AgendaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/scheduling/agenda/${token}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to load agenda');
        setData(null);
      } else {
        setData(json);
        setError(null);
      }
    } catch {
      setError('Failed to load agenda');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleTask = (key: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400">
        Loading agenda…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 px-6 py-16 text-center">
        <p className="text-red-400 mb-4">{error || 'Agenda not found'}</p>
        <Link href="/workspace?phase=Schedule" className="text-primary hover:underline text-sm">
          Back to scheduling
        </Link>
      </div>
    );
  }

  const { meeting, agenda } = data;

  return (
    <div className="min-h-screen bg-gray-900 text-white px-4 sm:px-6 lg:px-[100px] py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <Link
            href="/workspace?lens=agenda"
            className="text-sm text-gray-400 hover:text-white mb-2 inline-block"
          >
            ← Workspace agenda
          </Link>
          <Link
            href="/workspace?phase=Schedule"
            className="text-sm text-gray-400 hover:text-white mb-4 inline-block ml-4"
          >
            Scheduling
          </Link>
          <h1 className="text-2xl font-bold">{meeting.title}</h1>
          <p className="text-gray-400 mt-1">
            {new Date(meeting.start).toLocaleString()} – {new Date(meeting.end).toLocaleString()}
          </p>
        </div>

        {agenda.projects.length === 0 ? (
          <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-4 text-sm text-gray-400 space-y-2">
            <p>No linked projects for this meeting yet.</p>
            <p>
              Link projects from the{' '}
              <Link href="/workspace?phase=Schedule" className="text-primary hover:underline">
                Schedule phase
              </Link>{' '}
              so they appear here and on your workspace agenda.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {agenda.projects.map((block) => (
              <section
                key={block.projectId}
                className="rounded-lg border border-gray-700 bg-gray-800/60 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleProject(block.projectId)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-700/30"
                >
                  {block.color && (
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: block.color }}
                    />
                  )}
                  <span className="font-semibold flex-1">{block.name}</span>
                  <span className="text-gray-500 text-xs">
                    {expandedProjects.has(block.projectId) ? '▼' : '▶'}
                  </span>
                </button>

                {expandedProjects.has(block.projectId) && (
                  <div className="px-4 pb-4 border-t border-gray-700 space-y-4">
                    <div className="pt-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Project comments</p>
                      <CommentThread
                        entityType="project"
                        entityId={block.projectId}
                        showHeading={false}
                        pollIntervalMs={COMMENT_POLL_MS}
                      />
                    </div>

                    {block.tasks.length === 0 ? (
                      <p className="text-sm text-gray-500">No tasks in this meeting window.</p>
                    ) : (
                      <ul className="space-y-2">
                        {block.tasks.map((task) => {
                          const taskKey = `${block.projectId}-${task.taskId}`;
                          const open = expandedTasks.has(taskKey);
                          return (
                            <li
                              key={taskKey}
                              className="rounded border border-gray-600 bg-gray-900/50"
                            >
                              <button
                                type="button"
                                onClick={() => toggleTask(taskKey)}
                                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left"
                              >
                                <span>{task.name}</span>
                                <span className="text-gray-500 text-xs shrink-0">
                                  {task.status || 'active'} {open ? '▼' : '▶'}
                                </span>
                              </button>
                              {open && (
                                <div className="px-3 pb-3 border-t border-gray-700">
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
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MeetingAgendaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400">
          Loading…
        </div>
      }
    >
      <AgendaContent />
    </Suspense>
  );
}
