import { NextResponse } from 'next/server';
import { z } from 'zod';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import OnboardingBookingModel from '@/lib/models/OnboardingBooking';
import { PlatformOnboardingSettingsModel } from '@/lib/models/PlatformOnboardingSettings';
import {
  listOnboardingAvailability,
  requireOnboardingEligible,
} from '@/lib/onboarding/requireOnboardingEligible';
import { assignHostRoundRobin } from '@/lib/onboarding/slotEngine';
import { buildIcsInvite, buildOnboardingInviteText } from '@/lib/onboarding/calendarInvite';
import { sendEmail } from '@/lib/services/email';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  start: z.string().datetime(),
  attendeeName: z.string().min(1).max(120).optional(),
  attendeeEmail: z.string().email().optional(),
});

export async function GET() {
  const gate = await requireOnboardingEligible();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const booking = await OnboardingBookingModel.findOne({
    organizationId: gate.organizationId,
    status: 'scheduled',
    start: { $gte: new Date() },
  })
    .sort({ start: 1 })
    .lean();

  return NextResponse.json({ booking: booking ?? null });
}

export async function POST(request: Request) {
  const gate = await requireOnboardingEligible();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await OnboardingBookingModel.findOne({
    organizationId: gate.organizationId,
    status: 'scheduled',
    start: { $gte: new Date() },
  }).lean();
  if (existing) {
    return NextResponse.json({ error: 'You already have an upcoming onboarding call' }, { status: 409 });
  }

  const availability = await listOnboardingAvailability();
  if (!availability.ok) {
    return NextResponse.json({ error: availability.error }, { status: availability.status });
  }

  const slot = availability.slots.find((s) => s.start === parsed.data.start);
  if (!slot) {
    return NextResponse.json({ error: 'That time is no longer available' }, { status: 409 });
  }

  const eligibleHosts = gate.settings.hosts.filter(
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
    return NextResponse.json({ error: 'No host available for that slot' }, { status: 409 });
  }

  const attendeeName = parsed.data.attendeeName?.trim() || gate.user.name;
  const attendeeEmail = parsed.data.attendeeEmail?.trim() || gate.user.email;
  const start = new Date(slot.start);
  const end = new Date(slot.end);

  await connectDB();
  let booking;
  try {
    booking = await OnboardingBookingModel.create({
      organizationId: new mongoose.Types.ObjectId(gate.organizationId),
      userId: new mongoose.Types.ObjectId(gate.user.id),
      subscriptionPlanId: new mongoose.Types.ObjectId(gate.planId),
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
      return NextResponse.json({ error: 'That time was just booked' }, { status: 409 });
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
    uid: `onboarding-${booking._id.toString()}@nucleas.app`,
    start,
    end,
    summary: 'Nucleas onboarding call',
    description: 'Your onboarding call with the Nucleas team.',
    organizerEmail: host.email,
    attendeeEmail,
  });

  try {
    await sendEmail({
      to: attendeeEmail,
      subject: invite.subject,
      html: invite.html,
      text: invite.text,
      attachments: [{ name: 'onboarding.ics', content: ics }],
    });
    await sendEmail({
      to: host.email,
      subject: `Onboarding call booked — ${attendeeName}`,
      html: `<p>${attendeeName} (${attendeeEmail}) booked an onboarding call for ${start.toLocaleString()}.</p>`,
      text: `${attendeeName} (${attendeeEmail}) booked an onboarding call for ${start.toLocaleString()}.`,
      attachments: [{ name: 'onboarding.ics', content: ics }],
    });
    await OnboardingBookingModel.findByIdAndUpdate(booking._id, {
      calendarInviteSentAt: new Date(),
    });
  } catch (e) {
    console.error('[onboarding booking] email failed', e);
  }

  return NextResponse.json({ booking });
}
