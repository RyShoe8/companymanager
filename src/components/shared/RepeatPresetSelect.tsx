'use client';

import type { RecurrencePreset } from '@/lib/scheduling/recurrence';
import { formInputClassCompact } from '@/components/ui/formClasses';

export const REPEAT_OPTIONS: { value: RecurrencePreset; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

interface RepeatPresetSelectProps {
  value: RecurrencePreset;
  onChange: (preset: RecurrencePreset) => void;
  disabled?: boolean;
  className?: string;
  noneLabel?: string;
  ariaLabel?: string;
}

export default function RepeatPresetSelect({
  value,
  onChange,
  disabled = false,
  className = formInputClassCompact,
  noneLabel = 'No repeat',
  ariaLabel = 'Repeat',
}: RepeatPresetSelectProps) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as RecurrencePreset)}
      className={className}
      aria-label={ariaLabel}
    >
      {REPEAT_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.value === 'none' ? noneLabel : opt.label}
        </option>
      ))}
    </select>
  );
}
