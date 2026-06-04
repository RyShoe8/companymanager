'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

export type LinkedRecording = {
  _id: string;
  title: string;
  status: string;
  duration: number;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface LinkedRecordingChipsProps {
  projectId?: string;
  taskId?: string;
  contentItemId?: string;
  refreshToken?: number;
  chipClassName?: string;
}

export default function LinkedRecordingChips({
  projectId,
  taskId,
  contentItemId,
  refreshToken = 0,
  chipClassName = 'inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium text-primary max-w-[220px]',
}: LinkedRecordingChipsProps) {
  const [recordings, setRecordings] = useState<LinkedRecording[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRecordings = useCallback(async () => {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    if (taskId) params.set('taskId', taskId);
    if (contentItemId) params.set('contentItemId', contentItemId);
    if (!params.toString()) {
      setRecordings([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/recordings?${params.toString()}`);
      if (!res.ok) {
        setRecordings([]);
        return;
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        setRecordings([]);
        return;
      }
      setRecordings(
        data.map((r: LinkedRecording) => ({
          _id: r._id,
          title: r.title,
          status: r.status,
          duration: r.duration ?? 0,
        }))
      );
    } catch {
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, taskId, contentItemId]);

  useEffect(() => {
    void loadRecordings();
  }, [loadRecordings, refreshToken]);

  if (loading || recordings.length === 0) return null;

  return (
    <>
      {recordings.map((recording) => (
        <Link
          key={recording._id}
          href={`/recordings/${recording._id}`}
          className={`${chipClassName} hover:underline truncate`}
          title={`Recording · ${formatDuration(recording.duration)} · ${recording.status}`}
        >
          <span className="truncate">{recording.title}</span>
          <span className="shrink-0 opacity-80">· Rec</span>
        </Link>
      ))}
    </>
  );
}
