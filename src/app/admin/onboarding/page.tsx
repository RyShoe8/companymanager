'use client';

import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import { getTimezoneSelectOptions } from '@/lib/scheduling/timezoneOptions';

type Slot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  enabled?: boolean;
};

type Host = {
  id: string;
  email: string;
  name: string;
  timezone: string;
  slots: Slot[];
  active: boolean;
};

type Settings = {
  durationMinutes: number;
  minAdvanceHours: number;
  maxAdvanceDays: number;
  hosts: Host[];
};

type Booking = {
  _id: string;
  start: string;
  attendeeName: string;
  attendeeEmail: string;
  hostEmail: string;
};

type HostCalendarStatus = {
  hostId: string;
  email: string;
  status: 'connected' | 'user_not_found' | 'calendar_not_connected';
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function calendarStatusMessage(status: HostCalendarStatus['status']): string {
  switch (status) {
    case 'connected':
      return 'Google Calendar connected — existing events block booking slots.';
    case 'calendar_not_connected':
      return 'This user exists in Nucleas but has not connected Google Calendar (Meetings → connect calendar).';
    case 'user_not_found':
      return 'No Nucleas account with this email — calendar busy times cannot be checked.';
    default:
      return '';
  }
}

function newHost(): Host {
  return {
    id: crypto.randomUUID(),
    email: '',
    name: '',
    timezone: 'America/New_York',
    slots: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00', enabled: true }],
    active: true,
  };
}

export default function AdminOnboardingPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [hostCalendarStatus, setHostCalendarStatus] = useState<HostCalendarStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const defaultTimezoneOptions = useMemo(() => getTimezoneSelectOptions(), []);

  async function load() {
    const res = await fetch('/api/admin/onboarding');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Could not load settings');
      return;
    }
    setSettings(data.settings);
    setBookings(data.bookings ?? []);
    setHostCalendarStatus(data.hostCalendarStatus ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    const res = await fetch('/api/admin/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Save failed');
      return;
    }
    setSettings(data.settings);
  }

  async function cancelBooking(id: string) {
    const res = await fetch(`/api/admin/onboarding?bookingId=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === 'string' ? data.error : 'Cancel failed');
      return;
    }
    await load();
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-[100px] py-8">
        <p className="text-sm text-text-secondary">{error ?? 'Loading onboarding settings…'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-[100px] py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Onboarding calls</h1>
        <p className="text-sm text-text-secondary mt-1">
          Configure hosts, availability, and review upcoming bookings. Hosts must use the same
          email as their Nucleas account and connect Google Calendar to block busy times.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Global settings</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-text-secondary">Duration (minutes)</span>
            <input
              type="number"
              min={15}
              max={120}
              value={settings.durationMinutes}
              onChange={(e) =>
                setSettings((s) => s && { ...s, durationMinutes: Number(e.target.value) })
              }
              className="w-full rounded border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-text-secondary">Min advance (hours)</span>
            <input
              type="number"
              min={0}
              value={settings.minAdvanceHours}
              onChange={(e) =>
                setSettings((s) => s && { ...s, minAdvanceHours: Number(e.target.value) })
              }
              className="w-full rounded border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-text-secondary">Max advance (days)</span>
            <input
              type="number"
              min={1}
              max={90}
              value={settings.maxAdvanceDays}
              onChange={(e) =>
                setSettings((s) => s && { ...s, maxAdvanceDays: Number(e.target.value) })
              }
              className="w-full rounded border border-border bg-background px-3 py-2"
            />
          </label>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-text-primary">Hosts</h2>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setSettings((s) => s && { ...s, hosts: [...s.hosts, newHost()] })}
          >
            Add host
          </Button>
        </div>
        {settings.hosts.map((host, hostIndex) => {
          const calendarStatus = hostCalendarStatus.find((s) => s.hostId === host.id);
          const timezoneOptions =
            host.timezone && !defaultTimezoneOptions.some((o) => o.value === host.timezone)
              ? getTimezoneSelectOptions(host.timezone)
              : defaultTimezoneOptions;

          return (
          <div key={host.id} className="rounded-lg border border-border p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                placeholder="Name"
                value={host.name}
                onChange={(e) =>
                  setSettings((s) => {
                    if (!s) return s;
                    const hosts = [...s.hosts];
                    hosts[hostIndex] = { ...hosts[hostIndex], name: e.target.value };
                    return { ...s, hosts };
                  })
                }
                className="rounded border border-border bg-background-elevated px-3 py-2 text-sm text-text-primary"
              />
              <input
                placeholder="Email"
                type="email"
                value={host.email}
                onChange={(e) =>
                  setSettings((s) => {
                    if (!s) return s;
                    const hosts = [...s.hosts];
                    hosts[hostIndex] = { ...hosts[hostIndex], email: e.target.value };
                    return { ...s, hosts };
                  })
                }
                className="rounded border border-border bg-background-elevated px-3 py-2 text-sm text-text-primary"
              />
              <div className="sm:col-span-2">
                <Select
                  label="Timezone"
                  value={host.timezone}
                  onChange={(e) =>
                    setSettings((s) => {
                      if (!s) return s;
                      const hosts = [...s.hosts];
                      hosts[hostIndex] = { ...hosts[hostIndex], timezone: e.target.value };
                      return { ...s, hosts };
                    })
                  }
                  options={timezoneOptions}
                />
              </div>
            </div>
            {calendarStatus ? (
              <p
                className={`text-xs ${
                  calendarStatus.status === 'connected'
                    ? 'text-green-600'
                    : calendarStatus.status === 'calendar_not_connected'
                      ? 'text-amber-600'
                      : 'text-text-muted'
                }`}
              >
                {calendarStatusMessage(calendarStatus.status)}
              </p>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={host.active}
                onChange={(e) =>
                  setSettings((s) => {
                    if (!s) return s;
                    const hosts = [...s.hosts];
                    hosts[hostIndex] = { ...hosts[hostIndex], active: e.target.checked };
                    return { ...s, hosts };
                  })
                }
              />
              Active
            </label>
            {host.slots.map((slot, slotIndex) => (
              <div key={`${host.id}-${slotIndex}`} className="grid gap-2 sm:grid-cols-4 text-sm">
                <select
                  value={slot.dayOfWeek}
                  onChange={(e) =>
                    setSettings((s) => {
                      if (!s) return s;
                      const hosts = [...s.hosts];
                      const slots = [...hosts[hostIndex].slots];
                      slots[slotIndex] = { ...slots[slotIndex], dayOfWeek: Number(e.target.value) };
                      hosts[hostIndex] = { ...hosts[hostIndex], slots };
                      return { ...s, hosts };
                    })
                  }
                  className="rounded border border-border bg-background px-2 py-1.5"
                >
                  {DAY_LABELS.map((label, day) => (
                    <option key={label} value={day}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  value={slot.startTime}
                  onChange={(e) =>
                    setSettings((s) => {
                      if (!s) return s;
                      const hosts = [...s.hosts];
                      const slots = [...hosts[hostIndex].slots];
                      slots[slotIndex] = { ...slots[slotIndex], startTime: e.target.value };
                      hosts[hostIndex] = { ...hosts[hostIndex], slots };
                      return { ...s, hosts };
                    })
                  }
                  className="rounded border border-border bg-background px-2 py-1.5"
                />
                <input
                  value={slot.endTime}
                  onChange={(e) =>
                    setSettings((s) => {
                      if (!s) return s;
                      const hosts = [...s.hosts];
                      const slots = [...hosts[hostIndex].slots];
                      slots[slotIndex] = { ...slots[slotIndex], endTime: e.target.value };
                      hosts[hostIndex] = { ...hosts[hostIndex], slots };
                      return { ...s, hosts };
                    })
                  }
                  className="rounded border border-border bg-background px-2 py-1.5"
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={slot.enabled !== false}
                    onChange={(e) =>
                      setSettings((s) => {
                        if (!s) return s;
                        const hosts = [...s.hosts];
                        const slots = [...hosts[hostIndex].slots];
                        slots[slotIndex] = { ...slots[slotIndex], enabled: e.target.checked };
                        hosts[hostIndex] = { ...hosts[hostIndex], slots };
                        return { ...s, hosts };
                      })
                    }
                  />
                  Enabled
                </label>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setSettings((s) => {
                  if (!s) return s;
                  const hosts = [...s.hosts];
                  hosts[hostIndex] = {
                    ...hosts[hostIndex],
                    slots: [
                      ...hosts[hostIndex].slots,
                      { dayOfWeek: 2, startTime: '09:00', endTime: '17:00', enabled: true },
                    ],
                  };
                  return { ...s, hosts };
                })
              }
            >
              Add window
            </Button>
          </div>
          );
        })}
        <Button type="button" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Upcoming bookings</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-text-secondary">No upcoming bookings.</p>
        ) : (
          bookings.map((booking) => (
            <div
              key={booking._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border border-border px-4 py-3 text-sm"
            >
              <div>
                <p className="text-text-primary">
                  {new Date(booking.start).toLocaleString()} — {booking.attendeeName}
                </p>
                <p className="text-text-secondary">
                  {booking.attendeeEmail} · host {booking.hostEmail}
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={() => void cancelBooking(booking._id)}>
                Cancel
              </Button>
            </div>
          ))
        )}
      </Card>

      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
