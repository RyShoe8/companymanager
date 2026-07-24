type AvailabilitySlot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  enabled?: boolean;
};

export type OnboardingHost = {
  id: string;
  email: string;
  name?: string;
  timezone: string;
  slots: AvailabilitySlot[];
  active?: boolean;
  lastAssignedAt?: Date | string | null;
};

export type OnboardingSettingsLike = {
  durationMinutes: number;
  minAdvanceHours: number;
  maxAdvanceDays: number;
  hosts: OnboardingHost[];
};

export type ExistingBookingLike = {
  hostId: string;
  start: Date | string;
  end: Date | string;
  status?: string;
};

export type AvailableSlot = {
  start: string;
  end: string;
  hostIds: string[];
};

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map((v) => Number.parseInt(v, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function slotOverlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function zonedParts(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    dayOfWeek: weekdayMap[get('weekday')] ?? 0,
    hour: Number.parseInt(get('hour'), 10),
    minute: Number.parseInt(get('minute'), 10),
  };
}

function utcFromZonedLocal(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const asZoned = zonedParts(guess, timeZone);
  const offsetMinutes =
    asZoned.hour * 60 + asZoned.minute - (hour * 60 + minute);
  return new Date(guess.getTime() - offsetMinutes * 60_000);
}

export function computeAvailableSlots(
  settings: OnboardingSettingsLike,
  existingBookings: ExistingBookingLike[],
  now: Date = new Date()
): AvailableSlot[] {
  const durationMs = settings.durationMinutes * 60_000;
  const minStart = new Date(now.getTime() + settings.minAdvanceHours * 60 * 60_000);
  const maxStart = new Date(now.getTime() + settings.maxAdvanceDays * 24 * 60 * 60_000);

  const activeHosts = settings.hosts.filter((h) => h.active !== false && h.slots.length > 0);
  const scheduled = existingBookings.filter((b) => b.status !== 'canceled');
  const slotMap = new Map<string, Set<string>>();

  for (let dayOffset = 0; dayOffset <= settings.maxAdvanceDays; dayOffset++) {
    const day = new Date(now.getTime() + dayOffset * 24 * 60 * 60_000);
    const year = day.getUTCFullYear();
    const month = day.getUTCMonth() + 1;
    const date = day.getUTCDate();

    for (const host of activeHosts) {
      for (const window of host.slots) {
        if (window.enabled === false) continue;
        const hostLocal = zonedParts(
          utcFromZonedLocal(year, month, date, 12, 0, host.timezone),
          host.timezone
        );
        if (hostLocal.dayOfWeek !== window.dayOfWeek) continue;

        const startMin = parseTimeToMinutes(window.startTime);
        const endMin = parseTimeToMinutes(window.endTime);
        if (endMin <= startMin) continue;

        for (
          let cursor = startMin;
          cursor + settings.durationMinutes <= endMin;
          cursor += settings.durationMinutes
        ) {
          const startHour = Math.floor(cursor / 60);
          const startMinute = cursor % 60;
          const slotStart = utcFromZonedLocal(
            year,
            month,
            date,
            startHour,
            startMinute,
            host.timezone
          );
          const slotEnd = new Date(slotStart.getTime() + durationMs);

          if (slotStart < minStart || slotStart > maxStart) continue;

          const conflict = scheduled.some((booking) => {
            if (booking.hostId !== host.id) return false;
            const bStart = new Date(booking.start);
            const bEnd = new Date(booking.end);
            return slotOverlaps(slotStart, slotEnd, bStart, bEnd);
          });
          if (conflict) continue;

          const key = slotStart.toISOString();
          const hosts = slotMap.get(key) ?? new Set<string>();
          hosts.add(host.id);
          slotMap.set(key, hosts);
        }
      }
    }
  }

  return [...slotMap.entries()]
    .map(([start, hostIds]) => ({
      start,
      end: new Date(new Date(start).getTime() + durationMs).toISOString(),
      hostIds: [...hostIds],
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function assignHostRoundRobin(
  eligibleHosts: OnboardingHost[],
  slotStart: Date | string
): OnboardingHost | null {
  if (eligibleHosts.length === 0) return null;
  const sorted = [...eligibleHosts].sort((a, b) => {
    const aTime = a.lastAssignedAt ? new Date(a.lastAssignedAt).getTime() : 0;
    const bTime = b.lastAssignedAt ? new Date(b.lastAssignedAt).getTime() : 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.id.localeCompare(b.id);
  });
  void slotStart;
  return sorted[0] ?? null;
}
