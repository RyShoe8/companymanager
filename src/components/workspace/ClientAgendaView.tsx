'use client';

import { IClient } from '@/lib/models/Client';
import { IProject } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { TimeframeType, getTimeframeRange } from '@/lib/utils/dateUtils';
import { getPeriodViewTitle, shiftPeriodDate } from '@/lib/utils/periodNavigation';
import CalendarPeriodHeader from '@/components/planning-map/CalendarPeriodHeader';
import { buildClientCalendarRows, sortClientRowsByActivity } from '@/lib/clients/clientCalendarData';
import EmptyStateIllustration from '@/components/ui/EmptyStateIllustration';

interface ClientAgendaViewProps {
  clients: IClient[];
  allProjects: IProject[];
  contentItems: IContentItem[];
  showTasks: boolean;
  showContent: boolean;
  timeframe: TimeframeType;
  currentDate: Date;
  onClientClick: (client: IClient) => void;
  onDateChange: (date: Date) => void;
}

export default function ClientAgendaView({
  clients,
  allProjects,
  contentItems,
  showTasks,
  showContent,
  timeframe,
  currentDate,
  onClientClick,
  onDateChange,
}: ClientAgendaViewProps) {
  const rows = sortClientRowsByActivity(
    buildClientCalendarRows(clients, allProjects, contentItems, timeframe, currentDate, {
      showTasks,
      showContent,
    })
  ).filter((r) => r.hasActivityInRange || timeframe !== 'today');

  return (
    <div className="bg-background-elevated rounded-xl border border-border overflow-hidden">
      <CalendarPeriodHeader
        title={getPeriodViewTitle(timeframe, currentDate)}
        onPrev={() => onDateChange(shiftPeriodDate(timeframe, currentDate, 'prev'))}
        onNext={() => onDateChange(shiftPeriodDate(timeframe, currentDate, 'next'))}
      />
      <div className="p-6 space-y-3">
        {rows.length === 0 ? (
          <EmptyStateIllustration
            title="No client activity"
            description="No client tasks or content fall in this agenda period."
          />
        ) : (
          rows.map(({ client, tasksInRange, contentInRange }) => (
            <button
              key={String(client._id)}
              type="button"
              onClick={() => onClientClick(client)}
              className="w-full text-left rounded-lg border border-border bg-background p-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-text-primary">{client.name}</p>
                  <p className="text-xs text-text-secondary mt-1">
                    {showTasks ? `${tasksInRange} tasks` : null}
                    {showTasks && showContent ? ' · ' : null}
                    {showContent ? `${contentInRange} content` : null}
                  </p>
                </div>
                <span className="text-primary text-sm">Open</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
