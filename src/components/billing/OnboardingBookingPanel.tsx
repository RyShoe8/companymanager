'use client';

import { CallBookingPanel } from '@/components/billing/CallBookingPanel';

type Props = {
  title?: string;
  onBooked?: () => void;
};

export function OnboardingBookingPanel({ title = 'Schedule your onboarding call', onBooked }: Props) {
  return (
    <CallBookingPanel
      apiBase="/api/onboarding"
      title={title}
      description="Pick a time for a live walkthrough with our team."
      slotSelectId="onboarding-slot"
      bookButtonLabel="Book onboarding call"
      bookedTitle="Onboarding call scheduled"
      bookedDescription={(booking) =>
        `${new Date(booking.start).toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })} with ${booking.hostName || booking.hostEmail}. Calendar invites were emailed to you and your host.`
      }
      cancelConfirm="Cancel your onboarding call?"
      cancelButtonLabel="Cancel call"
      loadingLabel="Loading onboarding scheduling…"
      onBooked={onBooked}
    />
  );
}
