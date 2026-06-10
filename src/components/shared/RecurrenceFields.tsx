'use client';

import type { RecurrencePreset } from '@/lib/scheduling/recurrence';
import { expandInitialSeriesDates } from '@/lib/recurrence/recurrenceHorizons';
import { formInputClass } from '@/components/ui/formClasses';
import RepeatPresetSelect, { REPEAT_OPTIONS } from '@/components/shared/RepeatPresetSelect';

export { REPEAT_OPTIONS };

export interface RecurrenceFieldsProps {
  repeatPreset: RecurrencePreset;
  onRepeatPresetChange: (preset: RecurrencePreset) => void;
  inputClass?: string;
  anchorDate?: Date;
  occurrenceLabel?: string;
}

export default function RecurrenceFields({
  repeatPreset,
  onRepeatPresetChange,
  inputClass = formInputClass,
  anchorDate,
  occurrenceLabel = 'items',
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

  return (
    <label className="text-sm text-text-primary block">
      Repeat
      <RepeatPresetSelect
        value={repeatPreset}
        onChange={onRepeatPresetChange}
        className={inputClass}
        noneLabel="Does not repeat"
      />
      {occurrencePreview && (
        <p className="text-sm text-text-secondary mt-1">{occurrencePreview}</p>
      )}
    </label>
  );
}
