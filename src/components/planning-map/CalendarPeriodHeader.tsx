'use client';

import type { ReactNode } from 'react';
import PeriodNavButton from '@/components/ui/PeriodNavButton';

interface CalendarPeriodHeaderProps {
  title: string;
  onPrev: () => void;
  onNext: () => void;
  trailing?: ReactNode;
}

export default function CalendarPeriodHeader({
  title,
  onPrev,
  onNext,
  trailing,
}: CalendarPeriodHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 w-full">
      <div className="flex items-center gap-3 min-w-0">
        <PeriodNavButton direction="prev" onClick={onPrev} />
        <h3 className="text-lg font-semibold text-text-primary min-w-[220px] text-center">
          {title}
        </h3>
        <PeriodNavButton direction="next" onClick={onNext} />
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
