import { NextResponse } from 'next/server';
import { z } from 'zod';
import connectDB from '@/lib/db/mongodb';
import { requireAdminUser } from '@/lib/blog/requireAdmin';
import {
  getPlatformOnboardingSettings,
  PlatformOnboardingSettingsModel,
} from '@/lib/models/PlatformOnboardingSettings';
import OnboardingBookingModel from '@/lib/models/OnboardingBooking';
import { getHostCalendarLinkStatuses } from '@/lib/onboarding/hostCalendarBusy';

export const dynamic = 'force-dynamic';

const SlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  enabled: z.boolean().optional(),
});

const HostSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().optional(),
  timezone: z.string().min(1),
  slots: z.array(SlotSchema).default([]),
  active: z.boolean().optional(),
});

const PatchSchema = z.object({
  durationMinutes: z.number().int().min(15).max(120).optional(),
  minAdvanceHours: z.number().int().min(0).optional(),
  maxAdvanceDays: z.number().int().min(1).max(90).optional(),
  hosts: z.array(HostSchema).optional(),
});

export async function GET() {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  await connectDB();
  const settings = await getPlatformOnboardingSettings();
  const bookings = await OnboardingBookingModel.find({ status: 'scheduled', start: { $gte: new Date() } })
    .sort({ start: 1 })
    .limit(100)
    .lean();

  const hostCalendarStatus = await getHostCalendarLinkStatuses(
    settings.hosts.map((h) => ({ id: h.id, email: h.email }))
  );

  return NextResponse.json({ settings, bookings, hostCalendarStatus });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectDB();
  const settings = await getPlatformOnboardingSettings();
  const update: Record<string, unknown> = {};
  if (parsed.data.durationMinutes !== undefined) update.durationMinutes = parsed.data.durationMinutes;
  if (parsed.data.minAdvanceHours !== undefined) update.minAdvanceHours = parsed.data.minAdvanceHours;
  if (parsed.data.maxAdvanceDays !== undefined) update.maxAdvanceDays = parsed.data.maxAdvanceDays;
  if (parsed.data.hosts) {
    update.hosts = parsed.data.hosts.map((host) => {
      const existing = settings.hosts.find((h) => h.id === host.id);
      return {
        ...host,
        name: host.name ?? '',
        active: host.active ?? true,
        lastAssignedAt: existing?.lastAssignedAt,
      };
    });
  }

  const updated = await PlatformOnboardingSettingsModel.findByIdAndUpdate(
    settings._id,
    { $set: update },
    { new: true }
  );

  return NextResponse.json({ settings: updated });
}

export async function DELETE(request: Request) {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const bookingId = url.searchParams.get('bookingId');
  if (!bookingId) {
    return NextResponse.json({ error: 'bookingId required' }, { status: 400 });
  }

  await connectDB();
  const booking = await OnboardingBookingModel.findById(bookingId);
  if (!booking) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  booking.status = 'canceled';
  await booking.save();
  return NextResponse.json({ canceled: true });
}
