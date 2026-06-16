import connectDB from '@/lib/db/mongodb';
import { getPlatformOnboardingSettings } from '@/lib/models/PlatformOnboardingSettings';
import OnboardingBookingModel from '@/lib/models/OnboardingBooking';
import SalesCallBookingModel from '@/lib/models/SalesCallBooking';
import { PlatformOnboardingSettingsModel } from '@/lib/models/PlatformOnboardingSettings';
import { assignHostRoundRobin } from '@/lib/onboarding/slotEngine';
import { buildIcsInvite, buildOnboardingInviteText } from '@/lib/onboarding/calendarInvite';
import { getHostCalendarBusyBlocks } from '@/lib/onboarding/hostCalendarBusy';
import {
  computeAvailableSlots,
  type OnboardingSettingsLike,
} from '@/lib/onboarding/slotEngine';
import type { PlatformOnboardingSettingsDoc } from '@/lib/models/PlatformOnboardingSettings';
import { sendEmail } from '@/lib/services/email';

function settingsToSlotInput(settings: PlatformOnboardingSettingsDoc): OnboardingSettingsLike {
  return {
    durationMinutes: settings.durationMinutes,
    minAdvanceHours: settings.minAdvanceHours,
    maxAdvanceDays: settings.maxAdvanceDays,
    hosts: settings.hosts.map((h) => ({
      id: h.id,
      email: h.email,
      name: h.name,
      timezone: h.timezone,
      slots: h.slots,
      active: h.active,
      lastAssignedAt: h.lastAssignedAt,
    })),
  };
}

export async function computePublicCallAvailableSlots(now: Date = new Date()) {
  await connectDB();
  const settings = await getPlatformOnboardingSettings();
  const activeHosts = settings.hosts.filter((h) => h.active !== false);
  if (activeHosts.length === 0) {
    return { ok: false as const, status: 503, error: 'Call scheduling is not available yet' };
  }

  const slotSettings = settingsToSlotInput(settings);
  const rangeEnd = new Date(now.getTime() + settings.maxAdvanceDays * 24 * 60 * 60_000);

  const [onboardingBookings, salesBookings, calendarBusy] = await Promise.all([
    OnboardingBookingModel.find({ status: 'scheduled', start: { $gte: now } }).lean(),
    SalesCallBookingModel.find({ status: 'scheduled', start: { $gte: now } }).lean(),
    getHostCalendarBusyBlocks(
      activeHosts.map((h) => ({ id: h.id, email: h.email })),
      now,
      rangeEnd
    ),
  ]);

  const existing = [
    ...onboardingBookings.map((b) => ({
      hostId: b.hostId,
      start: b.start,
      end: b.end,
      status: b.status,
    })),
    ...salesBookings.map((b) => ({
      hostId: b.hostId,
      start: b.start,
      end: b.end,
      status: b.status,
    })),
    ...calendarBusy,
  ];

  const slots = computeAvailableSlots(slotSettings, existing, now);
  return { ok: true as const, settings, slots };
}

export async function createSalesCallBooking(input: {
  start: string;
  attendeeName: string;
  attendeeEmail: string;
}) {
  const availability = await computePublicCallAvailableSlots();
  if (!availability.ok) {
    return availability;
  }

  const slot = availability.slots.find((s) => s.start === input.start);
  if (!slot) {
    return { ok: false as const, status: 409, error: 'That time is no longer available' };
  }

  const eligibleHosts = availability.settings.hosts.filter(
    (h) => h.active !== false && slot.hostIds.includes(h.id)
  );
  const host = assignHostRoundRobin(
    eligibleHosts.map((h) => ({
      id: h.id,
      email: h.email,
      name: h.name,
      timezone: h.timezone,
      slots: h.slots,
      active: h.active,
      lastAssignedAt: h.lastAssignedAt,
    })),
    slot.start
  );
  if (!host) {
    return { ok: false as const, status: 409, error: 'No host available for that slot' };
  }

  const start = new Date(slot.start);
  const end = new Date(slot.end);
  const attendeeName = input.attendeeName.trim();
  const attendeeEmail = input.attendeeEmail.trim().toLowerCase();

  await connectDB();
  let booking;
  try {
    booking = await SalesCallBookingModel.create({
      hostId: host.id,
      hostEmail: host.email,
      hostName: host.name ?? '',
      start,
      end,
      status: 'scheduled',
      attendeeName,
      attendeeEmail,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not book slot';
    if (message.includes('duplicate key')) {
      return { ok: false as const, status: 409, error: 'That time was just booked' };
    }
    throw e;
  }

  await PlatformOnboardingSettingsModel.updateOne(
    { singletonKey: 'default', 'hosts.id': host.id },
    { $set: { 'hosts.$.lastAssignedAt': new Date() } }
  );

  const invite = buildOnboardingInviteText({
    attendeeName,
    hostName: host.name || host.email,
    start,
    end,
  });
  const ics = buildIcsInvite({
    uid: `sales-call-${booking._id.toString()}@nucleas.app`,
    start,
    end,
    summary: 'Nucleas call',
    description: 'Your call with the Nucleas team.',
    organizerEmail: host.email,
    attendeeEmail,
  });

  try {
    await sendEmail({
      to: attendeeEmail,
      subject: invite.subject.replace(/onboarding/gi, 'call'),
      html: invite.html.replace(/onboarding/gi, 'call'),
      text: invite.text.replace(/onboarding/gi, 'call'),
      attachments: [{ name: 'call.ics', content: ics }],
    });
    await sendEmail({
      to: host.email,
      subject: `Call booked — ${attendeeName}`,
      html: `<p>${attendeeName} (${attendeeEmail}) booked a call for ${start.toLocaleString()}.</p>`,
      text: `${attendeeName} (${attendeeEmail}) booked a call for ${start.toLocaleString()}.`,
      attachments: [{ name: 'call.ics', content: ics }],
    });
    await SalesCallBookingModel.findByIdAndUpdate(booking._id, {
      calendarInviteSentAt: new Date(),
    });
  } catch (e) {
    console.error('[sales call booking] email failed', e);
  }

  return { ok: true as const, booking };
}
