'use client';

import { useCallback, useEffect, useState } from 'react';
import WorkspaceFilterSelect from '@/components/workspace/WorkspaceFilterSelect';
import {
  DIGEST_INTERVAL_LABELS,
  WORKSPACE_DIGEST_INTERVALS,
  type WorkspaceDigestInterval,
} from '@/lib/workspace/notificationTypes';

type WorkspaceEmailDigestSelectProps = {
  layout?: 'inline' | 'stacked';
  onIntervalChange?: (interval: WorkspaceDigestInterval) => void;
};

export default function WorkspaceEmailDigestSelect({
  layout = 'inline',
  onIntervalChange,
}: WorkspaceEmailDigestSelectProps = {}) {
  const [interval, setInterval] = useState<WorkspaceDigestInterval>('off');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/workspace/notification-preferences');
        if (!res.ok) throw new Error('Failed to load email settings');
        const data = (await res.json()) as { interval?: WorkspaceDigestInterval };
        if (!cancelled) {
          const loaded = data.interval ?? 'off';
          setInterval(loaded);
          onIntervalChange?.(loaded);
        }
      } catch {
        if (!cancelled) setError('Could not load email settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = useCallback(async (next: WorkspaceDigestInterval) => {
    const previous = interval;
    setInterval(next);
    onIntervalChange?.(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/workspace/notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval: next }),
      });
      if (!res.ok) throw new Error('Failed to save');
    } catch {
      setInterval(previous);
      setError('Could not save email settings');
    } finally {
      setSaving(false);
    }
  }, [interval, onIntervalChange]);

  if (layout === 'stacked') {
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor="workspace-email-digest" className="text-sm font-medium text-text-primary">
          Email updates
        </label>
        <WorkspaceFilterSelect
          id="workspace-email-digest"
          value={interval}
          disabled={loading || saving}
          onChange={(e) => handleChange(e.target.value as WorkspaceDigestInterval)}
          className="py-1.5 w-full"
          aria-label="Email update frequency"
        >
          {WORKSPACE_DIGEST_INTERVALS.map((value) => (
            <option key={value} value={value}>
              {DIGEST_INTERVAL_LABELS[value]}
            </option>
          ))}
        </WorkspaceFilterSelect>
        {error ? <span className="text-xs text-red-500">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="workspace-email-digest" className="text-sm text-text-secondary whitespace-nowrap">
        Email updates
      </label>
      <WorkspaceFilterSelect
        id="workspace-email-digest"
        value={interval}
        disabled={loading || saving}
        onChange={(e) => handleChange(e.target.value as WorkspaceDigestInterval)}
        className="py-1.5 min-w-[9.5rem]"
        aria-label="Email update frequency"
      >
        {WORKSPACE_DIGEST_INTERVALS.map((value) => (
          <option key={value} value={value}>
            {DIGEST_INTERVAL_LABELS[value]}
          </option>
        ))}
      </WorkspaceFilterSelect>
      {error ? <span className="text-xs text-red-500">{error}</span> : null}
    </div>
  );
}
