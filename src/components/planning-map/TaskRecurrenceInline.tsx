'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RecurrenceEnd, RecurrencePreset } from '@/lib/scheduling/recurrence';
import { countRecurrenceOccurrences } from '@/lib/recurrence/expandRecurrenceDates';
import {
  REPEAT_OPTIONS,
  RECURRENCE_END_OPTIONS,
} from '@/components/shared/RecurrenceFields';
import { formInputClassCompact } from '@/components/ui/formClasses';

export type TaskRecurrenceValue = {
  preset: RecurrencePreset;
  end: RecurrenceEnd;
  until?: string;
  count?: number;
};

interface TaskRecurrenceInlineProps {
  anchorDate: Date;
  disabled?: boolean;
  onRecurrenceChange: (value: TaskRecurrenceValue) => void;
}

export default function TaskRecurrenceInline({
  anchorDate,
  disabled = false,
  onRecurrenceChange,
}: TaskRecurrenceInlineProps) {
  const [preset, setPreset] = useState<RecurrencePreset>('none');
  const [end, setEnd] = useState<RecurrenceEnd>('never');
  const [until, setUntil] = useState('');
  const [count, setCount] = useState('10');

  const emit = useCallback(
    (next: {
      preset: RecurrencePreset;
      end: RecurrenceEnd;
      until: string;
      count: string;
    }) => {
      const countNum = next.end === 'after' ? parseInt(next.count, 10) : undefined;
      onRecurrenceChange({
        preset: next.preset,
        end: next.end,
        until: next.end === 'on' ? next.until : undefined,
        count: Number.isFinite(countNum) ? countNum : undefined,
      });
    },
    [onRecurrenceChange]
  );

  useEffect(() => {
    emit({ preset, end, until, count });
  }, [preset, end, until, count, emit]);

  let preview: string | null = null;
  if (preset !== 'none' && !isNaN(anchorDate.getTime())) {
    try {
      const untilDate =
        end === 'on' && until ? new Date(`${until}T23:59:59`) : undefined;
      const countNum = end === 'after' ? parseInt(count, 10) : undefined;
      const n = countRecurrenceOccurrences({
        anchorDate,
        preset,
        end,
        until: untilDate,
        count: Number.isFinite(countNum) ? countNum : undefined,
      });
      preview = `${n} tasks`;
    } catch {
      preview = null;
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value={preset}
        disabled={disabled}
        onChange={(e) => setPreset(e.target.value as RecurrencePreset)}
        className={formInputClassCompact}
        aria-label="Repeat"
      >
        {REPEAT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.value === 'none' ? 'No repeat' : opt.label}
          </option>
        ))}
      </select>
      {preset !== 'none' && (
        <>
          <select
            value={end}
            disabled={disabled}
            onChange={(e) => setEnd(e.target.value as RecurrenceEnd)}
            className={formInputClassCompact}
            aria-label="Ends"
          >
            {RECURRENCE_END_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {end === 'on' && (
            <input
              type="date"
              value={until}
              disabled={disabled}
              onChange={(e) => setUntil(e.target.value)}
              className={formInputClassCompact}
              aria-label="End date"
            />
          )}
          {end === 'after' && (
            <input
              type="number"
              min={1}
              max={365}
              value={count}
              disabled={disabled}
              onChange={(e) => setCount(e.target.value)}
              className={`${formInputClassCompact} w-14`}
              aria-label="Occurrences"
            />
          )}
          {preview && <span className="text-xs text-gray-400 italic">{preview}</span>}
        </>
      )}
    </div>
  );
}
