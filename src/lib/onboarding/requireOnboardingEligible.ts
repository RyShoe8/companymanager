import '@/lib/billing-engine';
import connectDB from '@/lib/db/mongodb';
import { getSession } from '@/lib/auth/session';
import User from '@/lib/models/User';
import { OrganizationSubscriptionModel, SubscriptionPlanModel } from 'billing-engine/models';
import {
  getPlatformOnboardingSettings,
  type PlatformOnboardingSettingsDoc,
} from '@/lib/models/PlatformOnboardingSettings';
import OnboardingBookingModel from '@/lib/models/OnboardingBooking';
import SalesCallBookingModel from '@/lib/models/SalesCallBooking';
import { computeAvailableSlots, type OnboardingSettingsLike } from '@/lib/onboarding/slotEngine';
import { getHostCalendarBusyBlocks } from '@/lib/onboarding/hostCalendarBusy';

function settingsToSlotInput(
  settings: PlatformOnboardingSettingsDoc
): OnboardingSettingsLike {
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

export async function computeOnboardingAvailableSlots(
  settings: PlatformOnboardingSettingsDoc,
  now: Date = new Date()
) {
  const slotSettings = settingsToSlotInput(settings);
  const rangeEnd = new Date(now.getTime() + settings.maxAdvanceDays * 24 * 60 * 60_000);

  const [onboardingBookings, salesBookings, calendarBusy] = await Promise.all([
    OnboardingBookingModel.find({
      status: 'scheduled',
      start: { $gte: now },
    }).lean(),
    SalesCallBookingModel.find({
      status: 'scheduled',
      start: { $gte: now },
    }).lean(),
    getHostCalendarBusyBlocks(
      settings.hosts
        .filter((h) => h.active !== false)
        .map((h) => ({ id: h.id, email: h.email })),
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

  return computeAvailableSlots(slotSettings, existing, now);
}

export type OnboardingEligibility =
  | {
      ok: true;
      user: { id: string; email: string; name: string };
      organizationId: string;
      planId: string;
      settings: PlatformOnboardingSettingsDoc;
    }
  | { ok: false; status: number; error: string };

export async function requireOnboardingEligible(): Promise<OnboardingEligibility> {
  const session = await getSession();
  if (!session?.userId) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  await connectDB();
  const user = await User.findById(session.userId);
  if (!user?.organizationId) {
    return { ok: false, status: 400, error: 'No organization' };
  }
  if (user._id.toString() !== user.organizationId) {
    return { ok: false, status: 403, error: 'Only the organization owner can schedule onboarding' };
  }

  const orgSub = await OrganizationSubscriptionModel.findOne({
    organizationId: user.organizationId,
  }).lean();
  if (!orgSub?.subscriptionPlanId) {
    return { ok: false, status: 403, error: 'No active plan' };
  }

  const plan = await SubscriptionPlanModel.findById(orgSub.subscriptionPlanId).lean();
  if (!plan?.onboardingCallsEnabled) {
    return { ok: false, status: 403, error: 'Onboarding calls are not included on your plan' };
  }

  const settings = await getPlatformOnboardingSettings();
  const activeHosts = settings.hosts.filter((h) => h.active !== false);
  if (activeHosts.length === 0) {
    return { ok: false, status: 503, error: 'Onboarding scheduling is not available yet' };
  }

  return {
    ok: true,
    user: {
      id: user._id.toString(),
      email: user.email ?? '',
      name: user.name ?? user.email ?? 'Owner',
    },
    organizationId: user.organizationId,
    planId: String(orgSub.subscriptionPlanId),
    settings,
  };
}

export async function listOnboardingAvailability() {
  const gate = await requireOnboardingEligible();
  if (!gate.ok) return gate;

  const slots = await computeOnboardingAvailableSlots(gate.settings);

  return { ok: true as const, slots };
}
