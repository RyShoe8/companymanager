'use client';

import type { ReactNode } from 'react';
import type { WeekSpanLayout } from '@/lib/calendar/calendarItemMode';

export const GANTT_ITEM_ROW_HEIGHT = 56;

interface WeeklyItemGanttOverlayProps {
  layouts: WeekSpanLayout[];
  renderBar: (layout: WeekSpanLayout) => ReactNode;
}

export default function WeeklyItemGanttOverlay({
  layouts,
  renderBar,
}: WeeklyItemGanttOverlayProps) {
  if (layouts.length === 0) return null;

  return (
    <>
      {layouts.map((layout, idx) => (
        <div
          key={idx}
          className="absolute rounded-lg border-2 border-border overflow-hidden transition-all duration-300 hover:shadow-lg"
          style={{
            left: `calc(${layout.startCol * (100 / 7)}% + 4px)`,
            width: `calc(${layout.span * (100 / 7)}% - 8px)`,
            top: `${layout.top}px`,
            height: `${layout.height}px`,
          }}
        >
          {renderBar(layout)}
        </div>
      ))}
    </>
  );
}
