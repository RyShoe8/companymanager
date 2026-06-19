'use client';

import { IClient } from '@/lib/models/Client';
import { IProject } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { TimeframeType } from '@/lib/utils/dateUtils';
import { getCalendarPeriodTitle, navigateCalendarPeriod } from '@/lib/utils/calendarPeriodNav';
import CalendarPeriodHeader from '@/components/planning-map/CalendarPeriodHeader';
import { buildClientCalendarRows, sortClientRowsByActivity } from '@/lib/clients/clientCalendarData';
import { getProjectCardHeaderTextClass } from '@/lib/utils/colorContrast';
import EmptyStateIllustration from '@/components/ui/EmptyStateIllustration';
import Image from 'next/image';

interface ClientCalendarViewProps {
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

export default function ClientCalendarView({
  clients,
  allProjects,
  contentItems,
  showTasks,
  showContent,
  timeframe,
  currentDate,
  onClientClick,
  onDateChange,
}: ClientCalendarViewProps) {
  const rows = sortClientRowsByActivity(
    buildClientCalendarRows(clients, allProjects, contentItems, timeframe, currentDate, {
      showTasks,
      showContent,
    })
  );

  const visibleRows =
    timeframe === 'today'
      ? rows.filter((r) => r.hasActivityInRange || r.activeTaskCount > 0 || r.activeContentCount > 0)
      : rows;

  const viewTitle = getCalendarPeriodTitle(timeframe, currentDate);

  return (
    <div className="bg-background-elevated rounded-xl border border-border overflow-hidden">
      <CalendarPeriodHeader
        title={viewTitle}
        onPrev={() => onDateChange(navigateCalendarPeriod(timeframe, currentDate, 'prev'))}
        onNext={() => onDateChange(navigateCalendarPeriod(timeframe, currentDate, 'next'))}
      />

      <div className="p-6">
        {visibleRows.length === 0 ? (
          <EmptyStateIllustration
            title="No clients in this period"
            description="Add a client or adjust your timeframe to see client activity."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleRows.map(({ client, activeTaskCount, activeContentCount, tasksInRange, contentInRange }) => {
              const displayColor = client.color || '#3b82f6';
              const headerTextClass = getProjectCardHeaderTextClass(displayColor);
              return (
                <button
                  key={String(client._id)}
                  type="button"
                  onClick={() => onClientClick(client)}
                  className="text-left p-5 rounded-lg border-2 border-border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl relative"
                  style={{
                    backgroundColor: `${displayColor}F0`,
                    borderColor: displayColor,
                  }}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold overflow-hidden shrink-0 ${client.logo ? '' : headerTextClass}`}
                      style={client.logo ? undefined : { backgroundColor: displayColor }}
                    >
                      {client.logo ? (
                        <Image src={client.logo} alt="" width={40} height={40} className="w-full h-full object-cover" unoptimized />
                      ) : (
                        client.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className={`text-lg font-bold truncate ${headerTextClass}`}>{client.name}</h4>
                      {client.description ? (
                        <p className={`text-sm truncate ${headerTextClass} opacity-80`}>{client.description}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className={`flex flex-wrap gap-3 text-xs font-medium ${headerTextClass}`}>
                    {showTasks && (
                      <span>
                        {tasksInRange} task{tasksInRange === 1 ? '' : 's'} in period · {activeTaskCount} active
                      </span>
                    )}
                    {showContent && (
                      <span>
                        {contentInRange} content in period · {activeContentCount} active
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
