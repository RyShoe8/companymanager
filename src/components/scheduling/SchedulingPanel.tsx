'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { IProject } from '@/lib/models/Project';
import Button from '@/components/ui/Button';

type CalendarStatus = {
  connected: boolean;
  calendarId: string;
  syncedAt: string | null;
};

type AvailabilitySlot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type MeetingRow = {
  _id: string;
  title: string;
  start: string;
  end: string;
  agendaToken: string;
  linkedProjectIds: string[];
  googleEventId?: string;
  createdInNucleas?: boolean;
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

interface SchedulingPanelProps {
  projects: IProject[];
}

export default function SchedulingPanel({ projects }: SchedulingPanelProps) {
  const searchParams = useSearchParams();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [calendar, setCalendar] = useState<CalendarStatus | null>(null);
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [timezone, setTimezone] = useState('America/New_York');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newProjectIds, setNewProjectIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProjectIds, setEditProjectIds] = useState<string[]>([]);

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const rangeQuery = useMemo(() => {
    const s = weekStart.toISOString();
    const e = weekEnd.toISOString();
    return `start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`;
  }, [weekStart, weekEnd]);

  const loadCalendar = useCallback(async () => {
    const res = await fetch('/api/scheduling/calendar');
    if (res.ok) setCalendar(await res.json());
  }, []);

  const loadMeetings = useCallback(async () => {
    const res = await fetch(`/api/scheduling/meetings?${rangeQuery}`);
    if (res.ok) setMeetings(await res.json());
  }, [rangeQuery]);

  const loadAvailability = useCallback(async () => {
    const res = await fetch('/api/scheduling/availability');
    if (res.ok) {
      const data = await res.json();
      setSlots(data.slots || []);
      setTimezone(data.timezone || 'America/New_York');
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadCalendar(), loadMeetings(), loadAvailability()]);
    setLoading(false);
  }, [loadCalendar, loadMeetings, loadAvailability]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (searchParams.get('calendar_connected')) setMessage('Google Calendar connected.');
    const err = searchParams.get('calendar_error');
    if (err) setMessage(`Calendar error: ${err}`);
  }, [searchParams]);

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/scheduling/meetings/sync?${rangeQuery}`);
      const data = await res.json();
      if (!res.ok) setMessage(data.error || 'Sync failed');
      else {
        setMeetings(data.meetings || []);
        setMessage(`Synced: ${data.imported || 0} new, ${data.updated || 0} updated.`);
        await loadCalendar();
      }
    } catch {
      setMessage('Sync failed');
    }
    setSyncing(false);
  };

  const handleDisconnect = async () => {
    await fetch('/api/scheduling/google/disconnect', { method: 'POST' });
    await loadCalendar();
    setMessage('Calendar disconnected.');
  };

  const handleSaveAvailability = async () => {
    setSavingAvailability(true);
    const res = await fetch('/api/scheduling/availability', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone, slots }),
    });
    setSavingAvailability(false);
    setMessage(res.ok ? 'Availability saved.' : 'Failed to save availability.');
  };

  const updateSlot = (index: number, patch: Partial<AvailabilitySlot>) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const handleCreateMeeting = async () => {
    if (!newTitle.trim() || !newStart || !newEnd) return;
    setCreating(true);
    const res = await fetch('/api/scheduling/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.trim(),
        start: new Date(newStart).toISOString(),
        end: new Date(newEnd).toISOString(),
        linkedProjectIds: newProjectIds,
        syncToGoogle: true,
      }),
    });
    setCreating(false);
    if (res.ok) {
      setShowCreate(false);
      setNewTitle('');
      setNewStart('');
      setNewEnd('');
      setNewProjectIds([]);
      await loadMeetings();
      setMessage('Meeting created.');
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error || 'Failed to create meeting.');
    }
  };

  const handleSaveMeetingProjects = async (meetingId: string) => {
    const res = await fetch(`/api/scheduling/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedProjectIds: editProjectIds }),
    });
    if (res.ok) {
      setEditingId(null);
      await loadMeetings();
      setMessage('Meeting projects updated; agenda refreshed in calendar if linked.');
    } else {
      setMessage('Failed to update meeting.');
    }
  };

  const toggleNewProject = (id: string) => {
    setNewProjectIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleEditProject = (id: string) => {
    setEditProjectIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  if (loading) {
    return <div className="text-gray-400 py-12 text-center">Loading scheduling…</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {message && (
        <div className="rounded-lg border border-gray-600 bg-gray-800/80 px-4 py-2 text-sm text-gray-200">
          {message}
        </div>
      )}

      <section className="rounded-lg border border-gray-700 bg-gray-800/60 p-4">
        <h2 className="text-lg font-semibold text-white mb-3">Google Calendar</h2>
        {calendar?.connected ? (
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-300">
            <span className="text-green-400">Connected</span>
            {calendar.syncedAt && (
              <span>Last sync: {new Date(calendar.syncedAt).toLocaleString()}</span>
            )}
            <Button type="button" size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? 'Syncing…' : 'Sync meetings'}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-gray-400">Connect your calendar to import and create meetings.</p>
            <a
              href="/api/scheduling/google/connect"
              className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              Connect Google Calendar
            </a>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-700 bg-gray-800/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold text-white">Meetings</h2>
          <div className="flex items-center gap-2 text-sm">
            <Button type="button" size="sm" variant="secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              Prev week
            </Button>
            <span className="text-gray-400">
              {weekStart.toLocaleDateString()} – {addDays(weekStart, 6).toLocaleDateString()}
            </span>
            <Button type="button" size="sm" variant="secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              Next week
            </Button>
            <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? 'Cancel' : 'New meeting'}
            </Button>
          </div>
        </div>

        {showCreate && (
          <div className="mb-4 rounded-lg border border-gray-600 bg-gray-900/50 p-4 space-y-3">
            <input
              type="text"
              placeholder="Meeting title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-800 text-white px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-3">
              <label className="text-sm text-gray-400">
                Start
                <input
                  type="datetime-local"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="block mt-1 rounded border border-gray-600 bg-gray-800 text-white px-2 py-1 text-sm"
                />
              </label>
              <label className="text-sm text-gray-400">
                End
                <input
                  type="datetime-local"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  className="block mt-1 rounded border border-gray-600 bg-gray-800 text-white px-2 py-1 text-sm"
                />
              </label>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-2">Link projects</p>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {projects.map((p) => (
                  <label key={p._id.toString()} className="flex items-center gap-1 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={newProjectIds.includes(p._id.toString())}
                      onChange={() => toggleNewProject(p._id.toString())}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
            <Button type="button" size="sm" onClick={handleCreateMeeting} disabled={creating}>
              {creating ? 'Creating…' : 'Create meeting'}
            </Button>
          </div>
        )}

        {meetings.length === 0 ? (
          <p className="text-sm text-gray-500">No meetings this week. Sync your calendar or create one.</p>
        ) : (
          <ul className="space-y-3">
            {meetings.map((m) => (
              <li key={m._id} className="rounded-lg border border-gray-600 bg-gray-900/40 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{m.title}</p>
                    <p className="text-gray-400">
                      {new Date(m.start).toLocaleString()} – {new Date(m.end).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/scheduling/agenda/${m.agendaToken}`}
                      className="inline-flex items-center rounded-lg border border-gray-600 px-2 py-0.5 text-xs font-medium text-gray-200 hover:bg-gray-700/50"
                    >
                      Open agenda
                    </Link>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditingId(m._id);
                        setEditProjectIds(m.linkedProjectIds || []);
                      }}
                    >
                      Link projects
                    </Button>
                  </div>
                </div>
                {editingId === m._id && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="flex flex-wrap gap-2 mb-2 max-h-28 overflow-y-auto">
                      {projects.map((p) => (
                        <label key={p._id.toString()} className="flex items-center gap-1 text-xs text-gray-300">
                          <input
                            type="checkbox"
                            checked={editProjectIds.includes(p._id.toString())}
                            onChange={() => toggleEditProject(p._id.toString())}
                          />
                          {p.name}
                        </label>
                      ))}
                    </div>
                    <Button type="button" size="sm" onClick={() => handleSaveMeetingProjects(m._id)}>
                      Save links
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-gray-700 bg-gray-800/60 p-4">
        <h2 className="text-lg font-semibold text-white mb-3">Weekly availability</h2>
        <label className="block text-sm text-gray-400 mb-3">
          Timezone
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="block mt-1 w-full max-w-xs rounded border border-gray-600 bg-gray-800 text-white px-2 py-1 text-sm"
          />
        </label>
        <div className="space-y-2">
          {slots.map((slot, index) => (
            <div key={index} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="w-10 text-gray-400">{DAY_LABELS[slot.dayOfWeek]}</span>
              <input
                type="time"
                value={slot.startTime}
                onChange={(e) => updateSlot(index, { startTime: e.target.value })}
                className="rounded border border-gray-600 bg-gray-800 text-white px-2 py-1"
              />
              <span className="text-gray-500">to</span>
              <input
                type="time"
                value={slot.endTime}
                onChange={(e) => updateSlot(index, { endTime: e.target.value })}
                className="rounded border border-gray-600 bg-gray-800 text-white px-2 py-1"
              />
            </div>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          className="mt-3"
          onClick={handleSaveAvailability}
          disabled={savingAvailability}
        >
          {savingAvailability ? 'Saving…' : 'Save availability'}
        </Button>
      </section>
    </div>
  );
}
