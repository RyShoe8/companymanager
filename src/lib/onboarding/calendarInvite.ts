type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description: string;
  organizerEmail: string;
  attendeeEmail: string;
};

function formatIcsDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

export function buildIcsInvite(event: IcsEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nucleas//Onboarding//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(event.start)}`,
    `DTEND:${formatIcsDate(event.end)}`,
    `SUMMARY:${event.summary}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    `ORGANIZER:mailto:${event.organizerEmail}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${event.attendeeEmail}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.join('\r\n')}\r\n`;
}

export function buildOnboardingInviteText(args: {
  attendeeName: string;
  hostName: string;
  start: Date;
  end: Date;
}): { subject: string; html: string; text: string } {
  const when = args.start.toLocaleString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  const subject = 'Your Nucleas onboarding call is scheduled';
  const text = `Hi ${args.attendeeName},\n\nYour onboarding call with ${args.hostName} is scheduled for ${when}.\n\nWe attached a calendar invite for your convenience.\n\n— Nucleas`;
  const html = `<p>Hi ${args.attendeeName},</p><p>Your onboarding call with <strong>${args.hostName}</strong> is scheduled for <strong>${when}</strong>.</p><p>We attached a calendar invite for your convenience.</p><p>— Nucleas</p>`;
  return { subject, html, text };
}
