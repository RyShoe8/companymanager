import { IAvailabilitySlot } from '@/lib/models/UserAvailability';

/** JavaScript day index: 0=Sun, 1=Mon, …, 6=Sat. Display order Mon → Sun. */
export const WEEK_DAYS_MON_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;

export const DAY_LABELS_MON_FIRST: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

export type AvailabilitySlotInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  enabled?: boolean;
  outOfOffice?: boolean;
};

function defaultSlotForDay(dayOfWeek: number): AvailabilitySlotInput {
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  return {
    dayOfWeek,
    startTime: '09:00',
    endTime: '17:00',
    enabled: isWeekday,
  };
}

/** Ensure exactly one slot per day (0–6), merging saved values with defaults. */
export function normalizeAvailabilitySlots(
  slots?: AvailabilitySlotInput[] | IAvailabilitySlot[] | null
): AvailabilitySlotInput[] {
  const byDay = new Map<number, AvailabilitySlotInput>();

  for (const slot of slots ?? []) {
    const day = Number(slot.dayOfWeek);
    if (day < 0 || day > 6 || byDay.has(day)) continue;
    byDay.set(day, {
      dayOfWeek: day,
      startTime: slot.startTime || '09:00',
      endTime: slot.endTime || '17:00',
      enabled: slot.enabled !== false,
      outOfOffice: slot.outOfOffice === true,
    });
  }

  return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => byDay.get(dayOfWeek) ?? defaultSlotForDay(dayOfWeek));
}

const MON_FIRST_ORDER: Record<number, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  0: 6,
};

export function sortSlotsMonFirst(slots: AvailabilitySlotInput[]): AvailabilitySlotInput[] {
  return [...slots].sort(
    (a, b) => (MON_FIRST_ORDER[a.dayOfWeek] ?? 99) - (MON_FIRST_ORDER[b.dayOfWeek] ?? 99)
  );
}
