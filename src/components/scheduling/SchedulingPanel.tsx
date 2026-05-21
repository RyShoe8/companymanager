'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { IProject } from '@/lib/models/Project';
import Button from '@/components/ui/Button';
import CreateMeetingModal from '@/components/scheduling/CreateMeetingModal';
import {
  DAY_LABELS_MON_FIRST,
  normalizeAvailabilitySlots,
  sortSlotsMonFirst,
  WEEK_DAYS_MON_FIRST,
} from '@/lib/scheduling/availabilitySlots';

type CalendarStatus = {
  connected: boolean;
  calendarId: string;
  syncedAt: string | null;
};

type AvailabilitySlot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  enabled?: boolean;
};

type MeetingRow = {
  _id: string;
  title: string;
  start: string;
  end: string;
  agendaToken: string;
  linkedProjectIds: string[];
  googleEventId?: string;
  googleRecurringEventId?: string;
  createdInNucleas?: boolean;
};

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
  meetingRefreshKey?: number;
}

export default function SchedulingPanel({ projects, meetingRefreshKey = 0 }: SchedulingPanelProps) {
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

  const [showMeetingModal, setShowMeetingModal] = useState(false);

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
      setSlots(sortSlotsMonFirst(normalizeAvailabilitySlots(data.slots)));
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
    if (meetingRefreshKey > 0) {
      loadMeetings();
      setMessage('Meeting created.');
    }
  }, [meetingRefreshKey, loadMeetings]);

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
      body: JSON.stringify({ timezone, slots: normalizeAvailabilitySlots(slots) }),
    });
    setSavingAvailability(false);
    setMessage(res.ok ? 'Availability saved.' : 'Failed to save availability.');
  };

  const updateSlotByDay = (dayOfWeek: number, patch: Partial<AvailabilitySlot>) => {
    setSlots((prev) =>
      prev.map((s) => (s.dayOfWeek === dayOfWeek ? { ...s, ...patch } : s))
    );
  };

  const orderedSlots = useMemo(
    () =>
      WEEK_DAYS_MON_FIRST.map((day) => slots.find((s) => s.dayOfWeek === day)).filter(
        (s): s is AvailabilitySlot => !!s
      ),
    [slots]
  );

  const handleSaveMeetingProjects = async (meetingId: string) => {
    const editingMeeting = meetings.find((m) => m._id === meetingId);
    const res = await fetch(`/api/scheduling/meetings/${meetingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkedProjectIds: editProjectIds }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setEditingId(null);
      await loadMeetings();
      const participants =
        typeof data.participantsUpdatedCount === 'number' ? data.participantsUpdatedCount : 1;
      const calendars =
        typeof data.calendarsPatchedCount === 'number' ? data.calendarsPatchedCount : 0;
      if (editingMeeting?.googleRecurringEventId && participants > 1) {
        setMessage(
          `Projects linked across ${participants} meeting records${calendars > 0 ? `; ${calendars} Google Calendar${calendars === 1 ? '' : 's'} updated with agenda` : ''}.`
        );
      } else if (participants > 1) {
        setMessage(
          `Projects linked for ${participants} team members${calendars > 0 ? `; ${calendars} calendar${calendars === 1 ? '' : 's'} updated` : ' in Nucleas'}.`
        );
      } else {
        setMessage(
          calendars > 0
            ? 'Meeting projects updated; agenda refreshed in your Google Calendar.'
            : 'Meeting projects updated.'
        );
      }
    } else {
      setMessage(data.error || 'Failed to update meeting.');
    }
  };

  const toggleEditProject = (id: string) => {
    setEditProjectIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleMeetingCreated = async () => {
    await loadMeetings();
    setMessage('Meeting created.');
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

      <CreateMeetingModal
        isOpen={showMeetingModal}
        onClose={() => setShowMeetingModal(false)}
        projects={projects}
        onSuccess={handleMeetingCreated}
      />

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
            <Button type="button" size="sm" onClick={() => setShowMeetingModal(true)}>
              New meeting
            </Button>
          </div>
        </div>

        {meetings.length === 0 ? (
          <p className="text-sm text-gray-500">No meetings this week. Sync your calendar or create one.</p>
        ) : (
          <ul className="space-y-3">
            {meetings.map((m) => (
              <li key={m._id} className="rounded-lg border border-gray-600 bg-gray-900/40 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-white flex flex-wrap items-center gap-2">
                      {m.title}
                      {m.googleRecurringEventId && (
                        <span className="text-xs font-normal text-gray-500 border border-gray-600 rounded px-1.5 py-0.5">
                          Recurring
                        </span>
                      )}
                    </p>
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
          {orderedSlots.map((slot) => {
            const enabled = slot.enabled !== false;
            return (
              <div key={slot.dayOfWeek} className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer min-w-[5.5rem]">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) =>
                      updateSlotByDay(slot.dayOfWeek, { enabled: e.target.checked })
                    }
                    className="rounded border-gray-600"
                  />
                  <span className="text-xs text-gray-400">Available</span>
                </label>
                <span className="w-10 text-gray-400 font-medium">
                  {DAY_LABELS_MON_FIRST[slot.dayOfWeek]}
                </span>
                <input
                  type="time"
                  value={slot.startTime}
                  disabled={!enabled}
                  onChange={(e) =>
                    updateSlotByDay(slot.dayOfWeek, { startTime: e.target.value })
                  }
                  className="rounded border border-gray-600 bg-gray-800 text-white px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="time"
                  value={slot.endTime}
                  disabled={!enabled}
                  onChange={(e) =>
                    updateSlotByDay(slot.dayOfWeek, { endTime: e.target.value })
                  }
                  className="rounded border border-gray-600 bg-gray-800 text-white px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            );
          })}
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
