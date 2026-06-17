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
    <div className="flex flex-col gap-3 w-full sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 min-w-0 w-full sm:flex-row sm:items-center sm:gap-3 sm:flex-1">
        <h3 className="text-sm sm:hidden font-semibold text-text-primary text-center min-w-0 truncate px-1">
          {title}
        </h3>
        <div className="flex items-center justify-center gap-3 min-w-0 sm:flex-1">
          <PeriodNavButton direction="prev" onClick={onPrev} />
          <h3 className="hidden sm:block text-base sm:text-lg font-semibold text-text-primary min-w-0 flex-1 text-center truncate px-2">
            {title}
          </h3>
          <PeriodNavButton direction="next" onClick={onNext} />
        </div>
      </div>
      {trailing ? (
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
