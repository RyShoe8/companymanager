'use client';

import { TimeframeType } from '@/lib/utils/dateUtils';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';

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
    <>
      {/* Desktop: Show buttons */}
      <div className="hidden md:flex gap-2">
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
      
      {/* Mobile: Show dropdown */}
      <div className="md:hidden min-w-[120px]">
        <Select
          value={selected}
          onChange={(e) => onSelect(e.target.value as TimeframeType)}
          options={timeframes}
          className="bg-gray-800 text-white border-gray-700"
        />
      </div>
    </>
  );
}
