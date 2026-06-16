'use client';

import { CallBookingPanel } from '@/components/billing/CallBookingPanel';

export function SalesCallBookingPanel() {
  return (
    <CallBookingPanel
      apiBase="/api/sales-calls"
      title="Schedule a call"
      description="Choose a time that works for you. We'll send calendar invites to you and your host."
      slotSelectId="sales-call-slot"
      bookButtonLabel="Book call"
      bookedTitle="Call scheduled"
      bookedDescription={(booking) =>
        `${new Date(booking.start).toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })} with ${booking.hostName || booking.hostEmail}. Check your email for the calendar invite.`
      }
      cancelConfirm="Cancel your call?"
      cancelButtonLabel="Cancel call"
      loadingLabel="Loading available times…"
      requireAttendeeFields
      showCancel={false}
    />
  );
}
