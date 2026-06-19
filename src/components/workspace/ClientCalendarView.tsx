'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { IClient } from '@/lib/models/Client';
import { IProject } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { TimeframeType, getTimeframeRange } from '@/lib/utils/dateUtils';
import { getCalendarPeriodTitle, navigateCalendarPeriod } from '@/lib/utils/calendarPeriodNav';
import CalendarPeriodHeader from '@/components/planning-map/CalendarPeriodHeader';
import CalendarCardHeader, {
  CalendarActiveStats,
  CalendarProgressBar,
} from '@/components/planning-map/CalendarCardHeader';
import WeeklyDayGridShell from '@/components/planning-map/WeeklyDayGridShell';
import { CalendarItemCardList } from '@/components/planning-map/CalendarItemCard';
import {
  collectCalendarItemsForDay,
  collectCalendarItemsForRange,
  sortFlatRangeItems,
  taskIndexForEntry,
  type CalendarItemEntry,
  type CalendarItemModeOptions,
  calendarDayKey,
} from '@/lib/calendar/calendarItemMode';
import {
  buildClientCalendarRows,
  sortClientRowsByActivity,
  clientsForRange,
  type ClientCalendarProjectRow,
  type ClientCalendarRow,
} from '@/lib/clients/clientCalendarData';
import { getProjectCardHeaderTextClass } from '@/lib/utils/colorContrast';
import EmptyStateIllustration from '@/components/ui/EmptyStateIllustration';

const WEEKLY_HEADER_HEIGHT = 100;
const WEEKLY_EXPANDED_PROJECT_HEIGHT = 88;
const WEEKLY_BOTTOM_PADDING = 16;

interface ClientCalendarViewProps {
  clients: IClient[];
  allProjects: IProject[];
  contentItems: IContentItem[];
  showTasks: boolean;
  showContent: boolean;
  timeframe: TimeframeType;
  currentDate: Date;
  onClientClick: (client: IClient) => void;
  onProjectClick?: (client: IClient, project: IProject) => void;
  onTaskClick?: (project: IProject, taskIndex: number) => void;
  onContentItemClick?: (item: IContentItem) => void;
  onDateChange: (date: Date) => void;
}

function ProjectSubCard({
  row,
  client,
  showTasks,
  showContent,
  onProjectClick,
}: {
  row: ClientCalendarProjectRow;
  client: IClient;
  showTasks: boolean;
  showContent: boolean;
  onProjectClick?: (client: IClient, project: IProject) => void;
}) {
  const { project, activeTaskCount, activeContentCount, progressPercent } = row;
  const displayColor = project.status === 'in-review' ? '#ef4444' : project.color || '#3b82f6';
  const headerTextClass = getProjectCardHeaderTextClass(displayColor);

  return (
    <button
      type="button"
      onClick={() => onProjectClick?.(client, project)}
      className="text-left p-3 rounded-lg border-2 border-border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg relative w-full"
      style={{
        backgroundColor: `${displayColor}F0`,
        borderColor: displayColor,
      }}
    >
      <div className="flex items-start gap-2 mb-1">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold overflow-hidden shrink-0 ${project.logo ? '' : headerTextClass}`}
          style={project.logo ? undefined : { backgroundColor: displayColor }}
        >
          {project.logo ? (
            <Image src={project.logo} alt="" width={28} height={28} className="w-full h-full object-cover" unoptimized />
          ) : (
            <span className="text-xs">{project.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h5 className={`text-sm font-bold truncate ${headerTextClass}`}>{project.name}</h5>
        </div>
      </div>
      <CalendarProgressBar progressPercent={progressPercent} headerTextClass={headerTextClass} />
      <div className="mt-1">
        <CalendarActiveStats
          showTasks={showTasks}
          showContent={showContent}
          activeTaskCount={activeTaskCount}
          activeContentCount={activeContentCount}
          headerTextClass={headerTextClass}
        />
      </div>
    </button>
  );
}

function ClientCardBody({
  row,
  showTasks,
  showContent,
  isExpanded,
  onToggleExpand,
  onClientClick,
  onProjectClick,
  compact = false,
  scheduledHoursOverride,
}: {
  row: ClientCalendarRow;
  showTasks: boolean;
  showContent: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClientClick: (client: IClient) => void;
  onProjectClick?: (client: IClient, project: IProject) => void;
  compact?: boolean;
  scheduledHoursOverride?: number;
}) {
  const { client, projects, activeTaskCount, activeContentCount, scheduledHours, progressPercent } = row;
  const displayColor = client.color || '#3b82f6';

  return (
    <>
      <CalendarCardHeader
        name={client.name}
        logo={client.logo}
        color={displayColor}
        progressPercent={progressPercent}
        scheduledHours={scheduledHoursOverride ?? scheduledHours}
        activeTaskCount={activeTaskCount}
        activeContentCount={activeContentCount}
        showTasks={showTasks}
        showContent={showContent}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        onTitleClick={() => onClientClick(client)}
        compact={compact}
        hoursInline={compact}
      />
      {isExpanded && projects.length > 0 ? (
        <div className="mt-3 pt-3 border-t border-white/20 space-y-2">
          {projects.map((projectRow) => (
            <ProjectSubCard
              key={String(projectRow.project._id)}
              row={projectRow}
              client={client}
              showTasks={showTasks}
              showContent={showContent}
              onProjectClick={onProjectClick}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

function ClientChip({
  row,
  onClientClick,
}: {
  row: ClientCalendarRow;
  onClientClick: (client: IClient) => void;
}) {
  const { client } = row;
  const displayColor = client.color || '#3b82f6';
  const headerTextClass = getProjectCardHeaderTextClass(displayColor);

  return (
    <button
      type="button"
      onClick={() => onClientClick(client)}
      className="text-sm p-2 rounded cursor-pointer hover:opacity-80 w-full text-left flex items-center gap-2"
      style={{ backgroundColor: displayColor, color: 'white' }}
      title={client.name}
    >
      <span
        className={`w-6 h-6 rounded shrink-0 flex items-center justify-center text-xs font-bold overflow-hidden ${client.logo ? '' : headerTextClass}`}
        style={client.logo ? undefined : { backgroundColor: displayColor }}
      >
        {client.logo ? (
          <Image src={client.logo} alt="" width={24} height={24} className="w-full h-full object-cover" unoptimized />
        ) : (
          client.name.charAt(0).toUpperCase()
        )}
      </span>
      <span className="font-medium truncate">{client.name}</span>
    </button>
  );
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
  onProjectClick,
  onTaskClick,
  onContentItemClick,
  onDateChange,
}: ClientCalendarViewProps) {
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const itemMode = showTasks || showContent;

  const clientIds = useMemo(() => new Set(clients.map((c) => String(c._id))), [clients]);

  const clientByProjectId = useMemo(() => {
    const clientMap = new Map(clients.map((c) => [String(c._id), c]));
    const map = new Map<string, IClient>();
    for (const project of allProjects) {
      const clientId = project.clientId?.toString();
      if (clientId && clientMap.has(clientId)) {
        map.set(String(project._id), clientMap.get(clientId)!);
      }
    }
    return map;
  }, [clients, allProjects]);

  const clientScopedProjects = useMemo(
    () => allProjects.filter((p) => p.clientId && clientIds.has(String(p.clientId))),
    [allProjects, clientIds]
  );

  const itemModeOptions: CalendarItemModeOptions = useMemo(
    () => ({
      showTasks,
      showContent,
      referenceDate: currentDate,
      projectFilter: (project) =>
        !!project.clientId && clientIds.has(String(project.clientId)),
    }),
    [showTasks, showContent, currentDate, clientIds]
  );

  const getClientBadge = (entry: CalendarItemEntry) => {
    const client = clientByProjectId.get(String(entry.project._id));
    if (!client) return undefined;
    return { name: client.name, color: client.color || '#3b82f6' };
  };

  const rows = sortClientRowsByActivity(
    buildClientCalendarRows(clients, allProjects, contentItems, timeframe, currentDate, {
      showTasks,
      showContent,
    })
  );

  const { start: startDate, end: endDate } = getTimeframeRange(timeframe, currentDate);

  const visibleRows =
    timeframe === 'today'
      ? rows.filter((r) => r.hasActivityInRange || r.activeTaskCount > 0 || r.activeContentCount > 0)
      : rows;

  const viewTitle = getCalendarPeriodTitle(timeframe, currentDate);

  const toggleClientExpanded = (clientId: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  useEffect(() => {
    const clientIds = new Set(clients.map((c) => String(c._id)));
    setExpandedClients((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of prev) {
        if (!clientIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [clients]);

  const renderClientGrid = (bucketRows: ClientCalendarRow[], emptyTitle: string, emptyDesc: string) => {
    if (bucketRows.length === 0) {
      return (
        <EmptyStateIllustration title={emptyTitle} description={emptyDesc} />
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {bucketRows.map((row) => {
          const clientId = String(row.client._id);
          const isExpanded = expandedClients.has(clientId);
          const displayColor = row.client.color || '#3b82f6';
          return (
            <div
              key={clientId}
              className="rounded-lg border-2 border-border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl relative overflow-hidden p-5"
              style={{
                backgroundColor: `${displayColor}F0`,
                borderColor: displayColor,
              }}
            >
              <ClientCardBody
                row={row}
                showTasks={showTasks}
                showContent={showContent}
                isExpanded={isExpanded}
                onToggleExpand={() => toggleClientExpanded(clientId)}
                onClientClick={onClientClick}
                onProjectClick={onProjectClick}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const renderItemCardList = (
    items: CalendarItemEntry[],
    opts?: { compact?: boolean; className?: string }
  ) => (
    <CalendarItemCardList
      items={items}
      getSeenStatus={() => 'none'}
      getTaskIndex={(entry) => taskIndexForEntry(entry)}
      getClientBadge={getClientBadge}
      onTaskClick={onTaskClick}
      onContentItemClick={onContentItemClick}
      compact={opts?.compact}
      className={opts?.className}
    />
  );

  const renderTodayView = () => {
    if (itemMode) {
      const today = new Date(startDate);
      today.setHours(0, 0, 0, 0);
      const items = collectCalendarItemsForDay(
        today,
        clientScopedProjects,
        contentItems,
        itemModeOptions
      );
      if (items.length === 0) {
        return (
          <div className="p-6">
            <EmptyStateIllustration
              title="No tasks or content today"
              description="No client tasks or content are scheduled for today."
            />
          </div>
        );
      }
      return <div className="p-6">{renderItemCardList(items)}</div>;
    }
    return (
      <div className="p-6">
        {renderClientGrid(
          visibleRows,
          'No clients in this period',
          'Add a client or adjust your timeframe to see client activity.'
        )}
      </div>
    );
  };

  const renderWeeklyView = () => {
    if (itemMode) {
      const days: Date[] = [];
      const current = new Date(startDate);
      for (let i = 0; i < 7; i++) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      const rangeItems = sortFlatRangeItems(
        collectCalendarItemsForRange(startDate, endDate, clientScopedProjects, contentItems, itemModeOptions),
        itemModeOptions
      );
      const itemsByDay = new Map<string, CalendarItemEntry[]>();
      for (const day of days) itemsByDay.set(calendarDayKey(day), []);
      for (const item of rangeItems) {
        const key = calendarDayKey(item.day);
        if (!itemsByDay.has(key)) itemsByDay.set(key, []);
        itemsByDay.get(key)!.push(item);
      }

      return (
        <WeeklyDayGridShell
          startDate={startDate}
          minColumnHeight={600}
          renderColumn={(day) => {
            const dayItems = itemsByDay.get(calendarDayKey(day)) ?? [];
            if (dayItems.length === 0) return null;
            return renderItemCardList(dayItems, { compact: true });
          }}
        />
      );
    }

    const weekRows = clientsForRange(rows, startDate, endDate, allProjects, contentItems);
    const baseTop = 60;

    const cardHeights = weekRows.map((row) => {
      const clientId = String(row.client._id);
      const isExpanded = expandedClients.has(clientId);
      if (!isExpanded) return WEEKLY_HEADER_HEIGHT + 16;
      const projectCount = row.projects.length;
      return (
        WEEKLY_HEADER_HEIGHT +
        (projectCount > 0 ? 12 + projectCount * WEEKLY_EXPANDED_PROJECT_HEIGHT : 0) +
        WEEKLY_BOTTOM_PADDING
      );
    });

    const topPositions: number[] = [];
    let cursor = baseTop;
    for (let i = 0; i < weekRows.length; i++) {
      topPositions.push(cursor);
      cursor += cardHeights[i] + 8;
    }

    return (
      <WeeklyDayGridShell
        startDate={startDate}
        overlay={
          weekRows.length === 0 ? (
            <div className="p-8">
              <EmptyStateIllustration
                title="No clients this week"
                description="No client activity falls in this week."
              />
            </div>
          ) : (
            weekRows.map((row, idx) => {
              const clientId = String(row.client._id);
              const isExpanded = expandedClients.has(clientId);
              const displayColor = row.client.color || '#3b82f6';
              return (
                <div
                  key={clientId}
                  className="absolute left-4 right-4 rounded-lg border-2 overflow-hidden transition-all duration-300 hover:shadow-xl"
                  style={{
                    top: topPositions[idx],
                    height: cardHeights[idx],
                    backgroundColor: `${displayColor}F0`,
                    borderColor: displayColor,
                  }}
                >
                  <div className="p-4 h-full overflow-hidden flex flex-col">
                    <ClientCardBody
                      row={row}
                      showTasks={showTasks}
                      showContent={showContent}
                      isExpanded={isExpanded}
                      onToggleExpand={() => toggleClientExpanded(clientId)}
                      onClientClick={onClientClick}
                      onProjectClick={onProjectClick}
                      compact
                      scheduledHoursOverride={row.scheduledHours}
                    />
                  </div>
                </div>
              );
            })
          )
        }
      />
    );
  };

  const renderMonthlyView = () => {
    const firstDayOfMonth = new Date(startDate);
    const firstDay = firstDayOfMonth.getDay();
    const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
    const calendarStart = new Date(firstDayOfMonth);
    calendarStart.setDate(calendarStart.getDate() - mondayOffset);

    const lastDayOfMonth = new Date(endDate);
    const lastDay = lastDayOfMonth.getDay();
    const sundayOffset = lastDay === 0 ? 0 : 7 - lastDay;
    const calendarEnd = new Date(lastDayOfMonth);
    calendarEnd.setDate(calendarEnd.getDate() + sundayOffset);

    const days: Date[] = [];
    const current = new Date(calendarStart);
    while (current <= calendarEnd) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    const formatWeekLabel = (week: Date[]) => {
      const weekStart = week[0];
      const weekEnd = week[6];
      const startLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endLabel = weekEnd.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `Week of ${startLabel} – ${endLabel}`;
    };

    return (
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {weeks.map((week) => {
            const weekStart = new Date(week[0]);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(week[6]);
            weekEnd.setHours(23, 59, 59, 999);
            const weekClients = clientsForRange(rows, weekStart, weekEnd, allProjects, contentItems);
            const weekItems = itemMode
              ? sortFlatRangeItems(
                  collectCalendarItemsForRange(
                    weekStart,
                    weekEnd,
                    clientScopedProjects,
                    contentItems,
                    itemModeOptions
                  ),
                  itemModeOptions
                )
              : [];

            return (
              <div key={weekStart.toISOString()} className="bg-background rounded-lg border border-border p-4 min-h-[300px]">
                <h3 className="text-lg font-semibold text-text-primary mb-3">{formatWeekLabel(week)}</h3>
                <div className="space-y-2">
                  {itemMode ? (
                    weekItems.length === 0 ? (
                      <EmptyStateIllustration
                        title="No tasks or content this week"
                        description="No client tasks or content fall in this week."
                      />
                    ) : (
                      renderItemCardList(weekItems, { compact: true })
                    )
                  ) : weekClients.length === 0 ? (
                    <EmptyStateIllustration
                      title="No clients this week"
                      description="No client activity in this week."
                    />
                  ) : (
                    weekClients.map((row) => {
                      const clientId = String(row.client._id);
                      const isExpanded = expandedClients.has(clientId);
                      const displayColor = row.client.color || '#3b82f6';
                      return (
                        <div
                          key={clientId}
                          className="rounded-lg border-2 overflow-hidden p-2"
                          style={{
                            backgroundColor: `${displayColor}E6`,
                            borderColor: displayColor,
                          }}
                        >
                          <ClientCardBody
                            row={row}
                            showTasks={showTasks}
                            showContent={showContent}
                            isExpanded={isExpanded}
                            onToggleExpand={() => toggleClientExpanded(clientId)}
                            onClientClick={onClientClick}
                            onProjectClick={onProjectClick}
                            compact
                            scheduledHoursOverride={row.scheduledHours}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderQuarterlyView = () => {
    const months: Date[][] = [];
    const quarter = Math.floor(currentDate.getMonth() / 3);

    for (let i = 0; i < 3; i++) {
      const monthDate = new Date(currentDate.getFullYear(), quarter * 3 + i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      months.push([monthStart, monthEnd]);
    }

    return (
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {months.map(([monthStart, monthEnd], idx) => {
            const monthClients = clientsForRange(rows, monthStart, monthEnd, allProjects, contentItems);
            const monthItems = itemMode
              ? sortFlatRangeItems(
                  collectCalendarItemsForRange(
                    monthStart,
                    monthEnd,
                    clientScopedProjects,
                    contentItems,
                    itemModeOptions
                  ),
                  itemModeOptions
                )
              : [];
            return (
              <div key={idx} className="bg-background rounded-lg border border-border p-4 min-h-[300px]">
                <h3 className="text-lg font-semibold text-text-primary mb-3">
                  {monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </h3>
                <div className="space-y-2">
                  {itemMode ? (
                    monthItems.length === 0 ? (
                      <EmptyStateIllustration
                        title="No tasks or content this month"
                        description="No client tasks or content fall in this month."
                      />
                    ) : (
                      renderItemCardList(monthItems, { compact: true })
                    )
                  ) : (
                    monthClients.map((row) => (
                      <ClientChip key={String(row.client._id)} row={row} onClientClick={onClientClick} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderYearlyView = () => {
    const months: Date[][] = [];
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(currentDate.getFullYear(), i, 1);
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      months.push([monthStart, monthEnd]);
    }

    return (
      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {months.map(([monthStart, monthEnd], idx) => {
            const monthClients = clientsForRange(rows, monthStart, monthEnd, allProjects, contentItems);
            const monthItems = itemMode
              ? sortFlatRangeItems(
                  collectCalendarItemsForRange(
                    monthStart,
                    monthEnd,
                    clientScopedProjects,
                    contentItems,
                    itemModeOptions
                  ),
                  itemModeOptions
                )
              : [];
            return (
              <div key={idx} className="bg-background rounded-lg border border-border p-4 min-h-[300px]">
                <h3 className="text-lg font-semibold text-text-primary mb-3">
                  {monthStart.toLocaleDateString('en-US', { month: 'short' })}
                </h3>
                <div className="space-y-2">
                  {itemMode ? (
                    monthItems.length === 0 ? (
                      <EmptyStateIllustration
                        title="No tasks or content this month"
                        description="No client tasks or content fall in this month."
                      />
                    ) : (
                      renderItemCardList(monthItems, { compact: true })
                    )
                  ) : (
                    monthClients.map((row) => (
                      <ClientChip key={String(row.client._id)} row={row} onClientClick={onClientClick} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-background-elevated rounded-xl border border-border overflow-hidden">
      <CalendarPeriodHeader
        title={viewTitle}
        onPrev={() => onDateChange(navigateCalendarPeriod(timeframe, currentDate, 'prev'))}
        onNext={() => onDateChange(navigateCalendarPeriod(timeframe, currentDate, 'next'))}
      />

      {timeframe === 'today' && renderTodayView()}
      {timeframe === 'weekly' && renderWeeklyView()}
      {timeframe === 'monthly' && renderMonthlyView()}
      {timeframe === 'quarterly' && renderQuarterlyView()}
      {timeframe === 'yearly' && renderYearlyView()}
    </div>
  );
}
