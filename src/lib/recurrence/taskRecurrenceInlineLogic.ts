import type { RecurrenceEnd, RecurrencePreset } from '@/lib/scheduling/recurrence';

export type TaskRecurrenceValue = {
  preset: RecurrencePreset;
  end: RecurrenceEnd;
  until?: string;
  count?: number;
};

export type TaskRecurrenceFormState = {
  preset: RecurrencePreset;
  end: RecurrenceEnd;
  until: string;
  count: string;
};

/** End options shown in the inline task repeat control (never excluded for safety). */
export const INLINE_RECURRENCE_END_OPTIONS: { value: RecurrenceEnd; label: string }[] = [
  { value: 'after', label: 'After' },
  { value: 'on', label: 'On date' },
];

export function buildTaskRecurrenceValue(state: TaskRecurrenceFormState): TaskRecurrenceValue {
  const countNum = state.end === 'after' ? parseInt(state.count, 10) : undefined;
  return {
    preset: state.preset,
    end: state.end,
    until: state.end === 'on' ? state.until : undefined,
    count: Number.isFinite(countNum) ? countNum : undefined,
  };
}

/** Returns an error message when Apply should be disabled, or null when valid. */
export function validateTaskRecurrenceApply(value: TaskRecurrenceValue): string | null {
  if (value.preset === 'none') return 'Select a repeat interval.';
  if (value.end === 'never') return 'Choose "After" occurrences or "On date" before applying.';
  if (value.end === 'on' && !value.until) return 'End date is required.';
  if (value.end === 'after') {
    if (value.count == null || !Number.isFinite(value.count) || value.count < 1) {
      return 'Number of occurrences must be at least 1.';
    }
    if (value.count > 365) return 'Number of occurrences cannot exceed 365.';
  }
  return null;
}

export function isTaskRecurrenceApplyReady(value: TaskRecurrenceValue): boolean {
  return validateTaskRecurrenceApply(value) === null;
}
