'use client';

import { useState } from 'react';
import type { RecurrencePreset } from '@/lib/scheduling/recurrence';
import { countRecurrenceOccurrences } from '@/lib/recurrence/expandRecurrenceDates';
import { REPEAT_OPTIONS } from '@/components/shared/RecurrenceFields';
import { formInputClassCompact } from '@/components/ui/formClasses';
import {
  buildTaskRecurrenceValue,
  INLINE_RECURRENCE_END_OPTIONS,
  isTaskRecurrenceApplyReady,
  type TaskRecurrenceValue,
} from '@/lib/recurrence/taskRecurrenceInlineLogic';

export type { TaskRecurrenceValue };

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
  const [end, setEnd] = useState<'after' | 'on'>('after');
  const [until, setUntil] = useState('');
  const [count, setCount] = useState('10');

  const currentValue = buildTaskRecurrenceValue({ preset, end, until, count });
  const applyReady = isTaskRecurrenceApplyReady(currentValue);

  let preview: string | null = null;
  if (preset !== 'none' && applyReady && !isNaN(anchorDate.getTime())) {
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

  const handlePresetChange = (next: RecurrencePreset) => {
    setPreset(next);
    if (next !== 'none') {
      setEnd('after');
    }
  };

  const handleApply = () => {
    if (!applyReady) return;
    onRecurrenceChange(currentValue);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value={preset}
        disabled={disabled}
        onChange={(e) => handlePresetChange(e.target.value as RecurrencePreset)}
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
            onChange={(e) => setEnd(e.target.value as 'after' | 'on')}
            className={formInputClassCompact}
            aria-label="Ends"
          >
            {INLINE_RECURRENCE_END_OPTIONS.map((opt) => (
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
          <button
            type="button"
            disabled={disabled || !applyReady}
            onClick={handleApply}
            className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply repeat
          </button>
        </>
      )}
    </div>
  );
}
