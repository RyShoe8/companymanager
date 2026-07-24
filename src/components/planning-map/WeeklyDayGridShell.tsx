'use client';

import type { ReactNode } from 'react';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function buildWeekDays(startDate: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(startDate);
  for (let i = 0; i < 7; i++) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

export function isCalendarToday(day: Date): boolean {
  const today = new Date();
  return day.toDateString() === today.toDateString();
}

interface WeeklyDayGridShellProps {
  startDate: Date;
  minColumnHeight?: number;
  renderColumn?: (day: Date, dayIdx: number) => ReactNode;
  overlay?: ReactNode;
}

export default function WeeklyDayGridShell({
  startDate,
  minColumnHeight = 1200,
  renderColumn,
  overlay,
}: WeeklyDayGridShellProps) {
  const days = buildWeekDays(startDate);

  return (
    <div className="overflow-x-auto overscroll-contain">
      <div className="min-w-[800px]">
        <div className="grid grid-cols-7 border-b border-border">
          {DAY_NAMES.map((day) => (
            <div
              key={day}
              className="p-3 text-center text-sm font-semibold text-text-secondary bg-background"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 divide-x divide-border relative">
          {days.map((day, dayIdx) => {
            const isCurrentDay = isCalendarToday(day);
            return (
              <div
                key={dayIdx}
                className={`p-4 relative z-0 ${isCurrentDay ? 'bg-primary-light' : ''}`}
                style={{ minHeight: minColumnHeight }}
              >
                <div
                  className={`text-lg font-semibold mb-3 ${
                    isCurrentDay ? 'text-primary' : 'text-text-primary'
                  }`}
                >
                  {day.getDate()}
                </div>
                {renderColumn ? (
                  <div className="space-y-2 relative" style={{ minHeight: minColumnHeight - 80 }}>
                    {renderColumn(day, dayIdx)}
                  </div>
                ) : null}
              </div>
            );
          })}
          {overlay ? (
            <div className="absolute inset-0 z-10 pointer-events-none">
              <div className="relative w-full h-full pointer-events-auto">{overlay}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
