'use client';

import type { ExtendUnit } from '@/lib/recurrence/recurrenceHorizons';
import { formInputClassCompact } from '@/components/ui/formClasses';

const EXTEND_OPTIONS: { value: ExtendUnit; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

interface ExtendSeriesSelectProps {
  disabled?: boolean;
  onExtend: (unit: ExtendUnit) => void;
  className?: string;
}

export default function ExtendSeriesSelect({
  disabled = false,
  onExtend,
  className = formInputClassCompact,
}: ExtendSeriesSelectProps) {
  return (
    <select
      defaultValue=""
      disabled={disabled}
      onChange={(e) => {
        const unit = e.target.value as ExtendUnit;
        if (unit) onExtend(unit);
        e.target.value = '';
      }}
      className={className}
      aria-label="Extend series"
    >
      <option value="">Extend…</option>
      {EXTEND_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
