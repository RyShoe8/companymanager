'use client';

import { TimeframeType } from '@/lib/utils/dateUtils';
import Button from '@/components/ui/Button';
import WorkspaceFilterSelect from '@/components/workspace/WorkspaceFilterSelect';

interface TimeHorizonSelectorProps {
  selected: TimeframeType;
  onSelect: (timeframe: TimeframeType) => void;
  mobileSelectClassName?: string;
}

const unselectedTimeframeClass =
  'bg-background-elevated border border-border text-text-secondary hover:text-text-primary hover:bg-background-card';

export default function TimeHorizonSelector({
  selected,
  onSelect,
  mobileSelectClassName = '',
}: TimeHorizonSelectorProps) {
  const timeframes: { value: TimeframeType; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  return (
    <>
      <div className="hidden md:flex gap-2" data-tour="time-horizon">
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

      <div className="md:hidden flex-1 min-w-0" data-tour="time-horizon">
        <WorkspaceFilterSelect
          value={selected}
          onChange={(e) => onSelect(e.target.value as TimeframeType)}
          className={mobileSelectClassName}
          aria-label="Time horizon"
        >
          {timeframes.map((timeframe) => (
            <option key={timeframe.value} value={timeframe.value}>
              {timeframe.label}
            </option>
          ))}
        </WorkspaceFilterSelect>
      </div>
    </>
  );
}
