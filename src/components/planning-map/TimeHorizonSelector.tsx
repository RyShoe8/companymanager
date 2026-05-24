'use client';

import { TimeframeType } from '@/lib/utils/dateUtils';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';

interface TimeHorizonSelectorProps {
  selected: TimeframeType;
  onSelect: (timeframe: TimeframeType) => void;
}

const unselectedTimeframeClass =
  'bg-background-elevated border border-border text-text-secondary hover:text-text-primary hover:bg-background-card';

export default function TimeHorizonSelector({ selected, onSelect }: TimeHorizonSelectorProps) {
  const timeframes: { value: TimeframeType; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  return (
    <>
      <div className="hidden md:flex gap-2">
        {timeframes.map((timeframe) => {
          const isSelected = selected === timeframe.value;
          return (
            <Button
              key={timeframe.value}
              variant={isSelected ? 'primary' : 'secondary'}
              size="sm"
              className={isSelected ? undefined : unselectedTimeframeClass}
              onClick={() => onSelect(timeframe.value)}
            >
              {timeframe.label}
            </Button>
          );
        })}
      </div>

      <div className="md:hidden min-w-[120px]">
        <Select
          value={selected}
          onChange={(e) => onSelect(e.target.value as TimeframeType)}
          options={timeframes}
          className="bg-background-elevated text-text-primary border-border"
        />
      </div>
    </>
  );
}
