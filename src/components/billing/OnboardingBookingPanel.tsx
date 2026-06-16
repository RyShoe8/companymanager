'use client';

import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

type Slot = { start: string; end: string; hostIds: string[] };

type Booking = {
  _id: string;
  start: string;
  end: string;
  hostEmail: string;
  hostName?: string;
  attendeeName: string;
  attendeeEmail: string;
};

type Props = {
  title?: string;
  onBooked?: () => void;
};

function formatSlotLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function OnboardingBookingPanel({ title = 'Schedule your onboarding call', onBooked }: Props) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [selectedStart, setSelectedStart] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [slotsRes, bookingRes] = await Promise.all([
        fetch('/api/onboarding/availability'),
        fetch('/api/onboarding/bookings'),
      ]);
      const slotsData = await slotsRes.json().catch(() => ({}));
      const bookingData = await bookingRes.json().catch(() => ({}));
      if (!slotsRes.ok) {
        throw new Error(typeof slotsData.error === 'string' ? slotsData.error : 'Could not load times');
      }
      if (!bookingRes.ok) {
        throw new Error(typeof bookingData.error === 'string' ? bookingData.error : 'Could not load booking');
      }
      setSlots(slotsData.slots ?? []);
      setBooking(bookingData.booking ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load onboarding scheduling');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function bookSlot() {
    if (!selectedStart) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: selectedStart }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not book call');
      }
      setBooking(data.booking ?? null);
      setSelectedStart('');
      onBooked?.();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not book call');
    } finally {
      setPending(false);
    }
  }

  async function cancelBooking() {
    if (!booking?._id) return;
    if (!window.confirm('Cancel your onboarding call?')) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/bookings/${booking._id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not cancel');
      }
      setBooking(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel');
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-text-secondary">Loading onboarding scheduling…</p>
      </Card>
    );
  }

  if (booking) {
    return (
      <Card className="p-6 space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Onboarding call scheduled</h2>
        <p className="text-sm text-text-secondary">
          {formatSlotLabel(booking.start)} with {booking.hostName || booking.hostEmail}. Calendar
          invites were emailed to you and your host.
        </p>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => void cancelBooking()}>
          {pending ? 'Canceling…' : 'Cancel call'}
        </Button>
        {error ? (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        <p className="text-sm text-text-secondary mt-1">
          Pick a time for a live walkthrough with our team.
        </p>
      </div>
      {slots.length === 0 ? (
        <p className="text-sm text-text-secondary">No times are available right now. Check back soon.</p>
      ) : (
        <div className="space-y-2">
          <label htmlFor="onboarding-slot" className="text-sm font-medium text-text-primary">
            Available times
          </label>
          <select
            id="onboarding-slot"
            value={selectedStart}
            onChange={(e) => setSelectedStart(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary"
          >
            <option value="">Select a time…</option>
            {slots.map((slot) => (
              <option key={slot.start} value={slot.start}>
                {formatSlotLabel(slot.start)}
              </option>
            ))}
          </select>
        </div>
      )}
      <Button
        type="button"
        disabled={!selectedStart || pending}
        onClick={() => void bookSlot()}
      >
        {pending ? 'Booking…' : 'Book onboarding call'}
      </Button>
      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
