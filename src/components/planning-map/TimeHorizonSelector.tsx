'use client';

import { TimeframeType } from '@/lib/utils/dateUtils';
import Button from '@/components/ui/Button';

interface TimeHorizonSelectorProps {
  selected: TimeframeType;
  onSelect: (timeframe: TimeframeType) => void;
}

export default function TimeHorizonSelector({ selected, onSelect }: TimeHorizonSelectorProps) {
  const timeframes: { value: TimeframeType; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  return (
    <div className="flex gap-2 mb-6">
      {timeframes.map((timeframe) => (
        <Button
          key={timeframe.value}
          variant={selected === timeframe.value ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onSelect(timeframe.value)}
        >
          {timeframe.label}
        </Button>
      ))}
    </div>
  );
}
