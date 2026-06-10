'use client';

import { useState } from 'react';
import type { RecurrencePreset } from '@/lib/scheduling/recurrence';
import RepeatPresetSelect from '@/components/shared/RepeatPresetSelect';
import type { TaskRecurrenceValue } from '@/lib/recurrence/taskRecurrenceInlineLogic';

export type { TaskRecurrenceValue };

interface TaskRecurrenceInlineProps {
  disabled?: boolean;
  onRecurrenceChange: (value: TaskRecurrenceValue) => void;
}

export default function TaskRecurrenceInline({
  disabled = false,
  onRecurrenceChange,
}: TaskRecurrenceInlineProps) {
  const [preset, setPreset] = useState<RecurrencePreset>('none');

  const handleChange = (next: RecurrencePreset) => {
    setPreset(next);
    if (next !== 'none') {
      onRecurrenceChange({ preset: next });
    }
  };

  return (
    <RepeatPresetSelect
      value={preset}
      onChange={handleChange}
      disabled={disabled}
    />
  );
}
