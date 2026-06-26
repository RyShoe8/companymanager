'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildWeekDays, isCalendarToday } from '@/components/planning-map/WeeklyDayGridShell';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type WeeklyMobileDayPagerProps = {
  startDate: Date;
  weekKey?: string;
  children: (day: Date, dayIndex: number) => ReactNode;
};

export default function WeeklyMobileDayPager({
  startDate,
  weekKey,
  children,
}: WeeklyMobileDayPagerProps) {
  const days = useMemo(() => buildWeekDays(startDate), [startDate]);

  const defaultIndex = useMemo(() => {
    const todayIdx = days.findIndex((d) => isCalendarToday(d));
    return todayIdx >= 0 ? todayIdx : 0;
  }, [days]);

  const [activeIdx, setActiveIdx] = useState(defaultIndex);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setActiveIdx(defaultIndex);
  }, [weekKey, defaultIndex]);

  const goPrev = useCallback(() => {
    setActiveIdx((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setActiveIdx((i) => Math.min(days.length - 1, i + 1));
  }, [days.length]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const startX = touchStartX.current;
      touchStartX.current = null;
      if (startX == null) return;
      const endX = e.changedTouches[0]?.clientX;
      if (endX == null) return;
      const delta = endX - startX;
      if (Math.abs(delta) < 48) return;
      if (delta < 0) goNext();
      else goPrev();
    },
    [goNext, goPrev]
  );

  const activeDay = days[activeIdx] ?? days[0];

  return (
    <div className="md:hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="flex items-center justify-between gap-2 px-1 py-2 border-b border-border bg-background">
        <button
          type="button"
          onClick={goPrev}
          disabled={activeIdx === 0}
          className="shrink-0 px-2 py-1 text-sm font-medium text-text-secondary hover:text-text-primary disabled:opacity-30"
          aria-label="Previous day"
        >
          ←
        </button>
        <div className="text-center min-w-0 flex-1">
          <div className="text-sm font-semibold text-text-primary">
            {DAY_NAMES[activeIdx]} {activeDay.getDate()}
          </div>
          <div className="flex items-center justify-center gap-1 mt-1">
            {days.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  idx === activeIdx ? 'bg-primary' : 'bg-border'
                }`}
                aria-label={`Go to ${DAY_NAMES[idx]}`}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={activeIdx === days.length - 1}
          className="shrink-0 px-2 py-1 text-sm font-medium text-text-secondary hover:text-text-primary disabled:opacity-30"
          aria-label="Next day"
        >
          →
        </button>
      </div>
      <div className="min-h-[320px]">{children(activeDay, activeIdx)}</div>
    </div>
  );
}
