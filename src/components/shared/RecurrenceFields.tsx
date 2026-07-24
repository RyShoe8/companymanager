'use client';

import type { RecurrencePreset } from '@/lib/scheduling/recurrence';
import { expandInitialSeriesDates } from '@/lib/recurrence/recurrenceHorizons';
import { formInputClass } from '@/components/ui/formClasses';
import RepeatPresetSelect from '@/components/shared/RepeatPresetSelect';

export interface RecurrenceFieldsProps {
  repeatPreset: RecurrencePreset;
  onRepeatPresetChange: (preset: RecurrencePreset) => void;
  inputClass?: string;
  anchorDate?: Date;
  occurrenceLabel?: string;
  inspectorStyled?: boolean;
}

export default function RecurrenceFields({
  repeatPreset,
  onRepeatPresetChange,
  inputClass = formInputClass,
  anchorDate,
  occurrenceLabel = 'items',
  inspectorStyled = false,
}: RecurrenceFieldsProps) {
  let occurrencePreview: string | null = null;
  if (repeatPreset !== 'none' && anchorDate && !isNaN(anchorDate.getTime())) {
    try {
      const n = expandInitialSeriesDates(anchorDate, repeatPreset).length;
      occurrencePreview = `This will create ${n} ${occurrenceLabel}.`;
    } catch {
      occurrencePreview = null;
    }
  }

  const labelClass = inspectorStyled
    ? 'text-sm text-gray-900 dark:text-white block'
    : 'text-sm text-text-primary block';
  const previewClass = inspectorStyled
    ? 'text-sm text-gray-500 dark:text-gray-400 mt-1'
    : 'text-sm text-text-secondary mt-1';

  return (
    <label className={labelClass}>
      Repeat
      <RepeatPresetSelect
        value={repeatPreset}
        onChange={onRepeatPresetChange}
        className={inputClass}
        noneLabel="Does not repeat"
      />
      {occurrencePreview && <p className={previewClass}>{occurrencePreview}</p>}
    </label>
  );
}
