'use client';

import type { RecurrenceEnd, RecurrencePreset } from '@/lib/scheduling/recurrence';
import { countRecurrenceOccurrences } from '@/lib/recurrence/expandRecurrenceDates';
import { formInputClass } from '@/components/ui/formClasses';

export const REPEAT_OPTIONS: { value: RecurrencePreset; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

export const RECURRENCE_END_OPTIONS: { value: RecurrenceEnd; label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: 'on', label: 'On date' },
  { value: 'after', label: 'After' },
];

export interface RecurrenceFieldsProps {
  repeatPreset: RecurrencePreset;
  onRepeatPresetChange: (preset: RecurrencePreset) => void;
  recurrenceEnd: RecurrenceEnd;
  onRecurrenceEndChange: (end: RecurrenceEnd) => void;
  recurrenceUntil: string;
  onRecurrenceUntilChange: (value: string) => void;
  recurrenceCount: string;
  onRecurrenceCountChange: (value: string) => void;
  inputClass?: string;
  /** When set, shows "This will create N …" when repeat is enabled. */
  anchorDate?: Date;
  occurrenceLabel?: string;
}

export default function RecurrenceFields({
  repeatPreset,
  onRepeatPresetChange,
  recurrenceEnd,
  onRecurrenceEndChange,
  recurrenceUntil,
  onRecurrenceUntilChange,
  recurrenceCount,
  onRecurrenceCountChange,
  inputClass = formInputClass,
  anchorDate,
  occurrenceLabel = 'items',
}: RecurrenceFieldsProps) {
  const showRecurrenceEnd = repeatPreset !== 'none';

  let occurrencePreview: string | null = null;
  if (showRecurrenceEnd && anchorDate && !isNaN(anchorDate.getTime())) {
    try {
      const until =
        recurrenceEnd === 'on' && recurrenceUntil
          ? new Date(`${recurrenceUntil}T23:59:59`)
          : undefined;
      const count =
        recurrenceEnd === 'after' ? parseInt(recurrenceCount, 10) : undefined;
      const n = countRecurrenceOccurrences({
        anchorDate,
        preset: repeatPreset,
        end: recurrenceEnd,
        until,
        count: Number.isFinite(count) ? count : undefined,
      });
      occurrencePreview = `This will create ${n} ${occurrenceLabel}.`;
    } catch {
      occurrencePreview = null;
    }
  }

  return (
    <>
      <label className="text-sm text-text-primary block">
        Repeat
        <select
          value={repeatPreset}
          onChange={(e) => onRepeatPresetChange(e.target.value as RecurrencePreset)}
          className={inputClass}
        >
          {REPEAT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {showRecurrenceEnd && (
        <div className="space-y-3 rounded-lg border border-border p-3 bg-background-card">
          <label className="text-sm text-text-primary block">
            Ends
            <select
              value={recurrenceEnd}
              onChange={(e) => onRecurrenceEndChange(e.target.value as RecurrenceEnd)}
              className={inputClass}
            >
              {RECURRENCE_END_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {recurrenceEnd === 'on' && (
            <label className="text-sm text-text-primary block">
              End date
              <input
                type="date"
                value={recurrenceUntil}
                onChange={(e) => onRecurrenceUntilChange(e.target.value)}
                required
                className={inputClass}
              />
            </label>
          )}
          {recurrenceEnd === 'after' && (
            <label className="text-sm text-text-primary block">
              Occurrences
              <input
                type="number"
                min={1}
                max={365}
                value={recurrenceCount}
                onChange={(e) => onRecurrenceCountChange(e.target.value)}
                required
                className={inputClass}
              />
            </label>
          )}
          {occurrencePreview && (
            <p className="text-sm text-text-secondary">{occurrencePreview}</p>
          )}
        </div>
      )}
    </>
  );
}
