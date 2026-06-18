'use client';

import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import RecaptchaNotice from '@/components/recaptcha/RecaptchaNotice';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { RECAPTCHA_ACTIONS } from '@/lib/recaptcha/actions';

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

export type CallBookingPanelConfig = {
  apiBase: string;
  title: string;
  description: string;
  slotSelectId: string;
  bookButtonLabel: string;
  bookedTitle: string;
  bookedDescription: (booking: Booking) => string;
  cancelConfirm: string;
  cancelButtonLabel: string;
  loadingLabel: string;
  requireAttendeeFields?: boolean;
  showCancel?: boolean;
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

export function CallBookingPanel({
  apiBase,
  title,
  description,
  slotSelectId,
  bookButtonLabel,
  bookedTitle,
  bookedDescription,
  cancelConfirm,
  cancelButtonLabel,
  loadingLabel,
  requireAttendeeFields = false,
  showCancel = true,
  onBooked,
}: CallBookingPanelConfig) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [selectedStart, setSelectedStart] = useState('');
  const [attendeeName, setAttendeeName] = useState('');
  const [attendeeEmail, setAttendeeEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { executeRecaptcha } = useRecaptcha();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const requests: Promise<Response>[] = [fetch(`${apiBase}/availability`)];
      if (showCancel) {
        requests.push(fetch(`${apiBase}/bookings`));
      }
      const [slotsRes, bookingRes] = await Promise.all(requests);
      const slotsData = await slotsRes.json().catch(() => ({}));
      if (!slotsRes.ok) {
        throw new Error(typeof slotsData.error === 'string' ? slotsData.error : 'Could not load times');
      }
      setSlots(slotsData.slots ?? []);

      if (showCancel && bookingRes) {
        const bookingData = await bookingRes.json().catch(() => ({}));
        if (!bookingRes.ok) {
          throw new Error(typeof bookingData.error === 'string' ? bookingData.error : 'Could not load booking');
        }
        setBooking(bookingData.booking ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load scheduling');
    } finally {
      setLoading(false);
    }
  }, [apiBase, showCancel]);

  useEffect(() => {
    void load();
  }, [load]);

  async function bookSlot() {
    if (!selectedStart) return;
    if (requireAttendeeFields && (!attendeeName.trim() || !attendeeEmail.trim())) {
      setError('Name and email are required');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const body: Record<string, string> = { start: selectedStart };
      if (requireAttendeeFields) {
        body.attendeeName = attendeeName.trim();
        body.attendeeEmail = attendeeEmail.trim();
        const recaptchaToken = await executeRecaptcha(RECAPTCHA_ACTIONS.bookCall);
        if (recaptchaToken) {
          body.recaptchaToken = recaptchaToken;
        }
      }
      const res = await fetch(`${apiBase}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
    if (!window.confirm(cancelConfirm)) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/bookings/${booking._id}`, { method: 'DELETE' });
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
        <p className="text-sm text-text-secondary">{loadingLabel}</p>
      </Card>
    );
  }

  if (booking) {
    return (
      <Card className="p-6 space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">{bookedTitle}</h2>
        <p className="text-sm text-text-secondary">{bookedDescription(booking)}</p>
        {showCancel ? (
          <Button type="button" variant="secondary" disabled={pending} onClick={() => void cancelBooking()}>
            {pending ? 'Canceling…' : cancelButtonLabel}
          </Button>
        ) : null}
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
        <p className="text-sm text-text-secondary mt-1">{description}</p>
      </div>
      {requireAttendeeFields ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Name"
            type="text"
            value={attendeeName}
            onChange={(e) => setAttendeeName(e.target.value)}
            required
            autoComplete="name"
          />
          <Input
            label="Email"
            type="email"
            value={attendeeEmail}
            onChange={(e) => setAttendeeEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
      ) : null}
      {slots.length === 0 ? (
        <p className="text-sm text-text-secondary">No times are available right now. Check back soon.</p>
      ) : (
        <div className="space-y-2">
          <label htmlFor={slotSelectId} className="text-sm font-medium text-text-primary">
            Available times
          </label>
          <select
            id={slotSelectId}
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
        {pending ? 'Booking…' : bookButtonLabel}
      </Button>
      {requireAttendeeFields ? (
        <RecaptchaNotice className="text-xs text-text-muted text-center" />
      ) : null}
      {error ? (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
