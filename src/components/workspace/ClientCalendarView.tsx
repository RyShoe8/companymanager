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
import {
  CalendarItemCardList,
  GANTT_ITEM_ROW_HEIGHT,
} from '@/components/planning-map/CalendarItemCard';
import WeeklyItemGanttOverlay from '@/components/planning-map/WeeklyItemGanttOverlay';
import {
  collectCalendarItemsForDay,
  collectCalendarItemsForRange,
  sortFlatRangeItems,
  taskIndexForEntry,
  collectUniqueSpanItemsForRange,
  layoutWeekSpanItems,
  spanItemToCalendarEntry,
  weekSpanGridMinHeight,
  type CalendarItemEntry,
  type CalendarItemModeOptions,
} from '@/lib/calendar/calendarItemMode';
import {
  buildClientCalendarRows,
  sortClientRowsByActivity,
  clientsForRange,
  computeClientTimeframeProgress,
  computeProjectTimeframeProgress,
  clientExpandSections,
  type ClientCalendarProjectRow,
  type ClientCalendarRow,
} from '@/lib/clients/clientCalendarData';
import { buildProjectEntityRangeItems } from '@/lib/calendar/projectEntityRangeItems';
import { isActiveMergedCalendarItem } from '@/lib/calendar/mergedCalendarItems';
import CalendarExpandedRangeItems from '@/components/planning-map/CalendarExpandedRangeItems';
import { resolveTaskIndexInProject } from '@/lib/utils/resolveTaskIndex';
import type { IProjectTask } from '@/lib/models/Project';
import {
  buildContentItemKey,
  buildTaskItemKey,
} from '@/lib/workspace/itemSeenState';
import { getProjectCardHeaderTextClass } from '@/lib/utils/colorContrast';
import EmptyStateIllustration from '@/components/ui/EmptyStateIllustration';
import {
  collectWorkspaceItemObservations,
  observeItemsForUser,
  readObservedItemsForUser,
  type ItemSeenStatus,
} from '@/lib/workspace/itemSeenState';

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
  currentUserId?: string | null;
  itemSeenRefreshTrigger?: number;
}

function ProjectSubCard({
  row,
  client,
  onProjectClick,
  titleOverride,
}: {
  row: ClientCalendarProjectRow;
  client: IClient;
  onProjectClick?: (client: IClient, project: IProject) => void;
  titleOverride?: string;
}) {
  const { project, activeTaskCount, activeContentCount, progressPercent } = row;
  const displayName = titleOverride ?? project.name;
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
            <span className="text-xs">{displayName.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h5 className={`text-sm font-bold truncate ${headerTextClass}`}>{displayName}</h5>
        </div>
      </div>
      <CalendarProgressBar progressPercent={progressPercent} headerTextClass={headerTextClass} />
      <div className="mt-1">
        <CalendarActiveStats
          showTasks={true}
          showContent={true}
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
  isExpanded,
  onToggleExpand,
  onClientClick,
  onProjectClick,
  compact = false,
  scheduledHoursOverride,
  contentItems,
  rangeStart,
  rangeEnd,
  currentDate,
  onTaskClick,
  onContentItemClick,
  taskSeenStatus,
  contentSeenStatus,
}: {
  row: ClientCalendarRow;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClientClick: (client: IClient) => void;
  onProjectClick?: (client: IClient, project: IProject) => void;
  compact?: boolean;
  scheduledHoursOverride?: number;
  contentItems?: IContentItem[];
  rangeStart?: Date;
  rangeEnd?: Date;
  currentDate?: Date;
  onTaskClick?: (project: IProject, taskIndex: number) => void;
  onContentItemClick?: (item: IContentItem) => void;
  taskSeenStatus?: (project: IProject, task: IProjectTask) => ItemSeenStatus;
  contentSeenStatus?: (project: IProject, item: IContentItem) => ItemSeenStatus;
}) {
  const {
    client,
    projects,
    hubProject,
    activeTaskCount,
    activeContentCount,
    scheduledHours,
    progressPercent,
  } = row;
  const hasExpandedContent = projects.length > 0 || !!hubProject;
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
        showTasks={true}
        showContent={true}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        onTitleClick={() => onClientClick(client)}
        compact={compact}
        hoursInline={compact}
      />
      {isExpanded && hasExpandedContent ? (
        <div className="mt-3 pt-3 border-t border-white/20 space-y-3">
          {clientExpandSections(row).map((section) => {
            const projectId = String(section.project._id);
            const isHub = section.label === 'Client tasks';
            const projectRow = isHub
              ? hubProject!
              : projects.find((p) => String(p.project._id) === projectId);
            
            if (!projectRow) return null;

            let displayList: any[] = [];
            if (contentItems && rangeStart && rangeEnd && currentDate) {
              const { merged } = buildProjectEntityRangeItems(
                section.project,
                contentItems,
                rangeStart,
                rangeEnd,
                currentDate
              );
              displayList = merged.filter(isActiveMergedCalendarItem);
            }

            return (
              <div key={projectId} className="space-y-2">
                <ProjectSubCard
                  row={projectRow}
                  client={client}
                  onProjectClick={onProjectClick}
                  titleOverride={isHub ? 'Client tasks' : undefined}
                />
                {displayList.length > 0 && taskSeenStatus && contentSeenStatus ? (
                  <div className="pl-3 border-l-2 border-border/50 ml-3 py-1 mt-2">
                    <CalendarExpandedRangeItems
                      project={section.project}
                      items={displayList}
                      keyPrefix={`clientcard-${String(client._id)}-${projectId}-${rangeStart?.getTime()}`}
                      onTaskClick={onTaskClick}
                      onContentItemClick={onContentItemClick}
                      getTaskSeenStatus={taskSeenStatus}
                      getContentSeenStatus={contentSeenStatus}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
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
  currentUserId = null,
  itemSeenRefreshTrigger,
}: ClientCalendarViewProps) {
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [itemStatusByKey, setItemStatusByKey] = useState<Record<string, ItemSeenStatus>>({});
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

  const workspaceItemEntries = useMemo(
    () => collectWorkspaceItemObservations(clientScopedProjects, contentItems),
    [clientScopedProjects, contentItems]
  );

  useEffect(() => {
    if (!currentUserId) return;
    const observed = observeItemsForUser(currentUserId, workspaceItemEntries);
    setItemStatusByKey(observed.statusByKey);
  }, [currentUserId, workspaceItemEntries]);

  useEffect(() => {
    if (!currentUserId || (itemSeenRefreshTrigger ?? 0) <= 0) return;
    const keys = workspaceItemEntries.map((entry) => entry.key);
    const observed = readObservedItemsForUser(currentUserId, keys);
    setItemStatusByKey(observed.statusByKey);
  }, [currentUserId, itemSeenRefreshTrigger, workspaceItemEntries]);

  const unseenCountByClientId = useMemo(() => {
    const map = new Map<string, number>();
    for (const project of clientScopedProjects) {
      const clientId = project.clientId?.toString();
      if (!clientId) continue;
      const projectId = project._id.toString();
      let count = map.get(clientId) ?? 0;
      for (const [key, status] of Object.entries(itemStatusByKey)) {
        if (status === 'none') continue;
        if (key.startsWith(`task:${projectId}:`) || key.startsWith(`content:${projectId}:`)) {
          count += 1;
        }
      }
      map.set(clientId, count);
    }
    return map;
  }, [clientScopedProjects, itemStatusByKey]);

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
    buildClientCalendarRows(clients, allProjects, contentItems, timeframe, currentDate),
    unseenCountByClientId
  );

  useEffect(() => {
    if (!currentUserId) return;
    const toExpand: string[] = [];
    for (const row of rows) {
      const clientId = String(row.client._id);
      if ((unseenCountByClientId.get(clientId) ?? 0) > 0) {
        toExpand.push(clientId);
      }
    }
    if (toExpand.length === 0) return;
    setExpandedClients((prev) => {
      const next = new Set(prev);
      for (const id of toExpand) {
        next.add(id);
      }
      return next;
    });
  }, [rows, unseenCountByClientId, currentUserId]);

  const clientRowForBucket = (
    row: ClientCalendarRow,
    rangeStart: Date,
    rangeEnd: Date
  ): ClientCalendarRow => {
    const clientProjects = allProjects.filter(
      (p) => String(p.clientId) === String(row.client._id)
    );
    return {
      ...row,
      progressPercent: computeClientTimeframeProgress(
        clientProjects,
        contentItems,
        rangeStart,
        rangeEnd,
        currentDate
      ),
      projects: row.projects.map((projectRow) => ({
        ...projectRow,
        progressPercent: computeProjectTimeframeProgress(
          projectRow.project,
          contentItems,
          rangeStart,
          rangeEnd,
          currentDate
        ),
      })),
    };
  };

  const { start: startDate, end: endDate } = getTimeframeRange(timeframe, currentDate);

  const taskSeenStatus = (project: IProject, task: IProjectTask): ItemSeenStatus => {
    const idx = resolveTaskIndexInProject(project, task);
    if (idx < 0) return 'none';
    const key = buildTaskItemKey(
      project._id.toString(),
      (task as { _id?: { toString(): string } })._id?.toString() ?? null,
      idx
    );
    return itemStatusByKey[key] ?? 'none';
  };

  const contentSeenStatus = (project: IProject, item: IContentItem): ItemSeenStatus =>
    itemStatusByKey[
      buildContentItemKey(item.projectId?.toString() ?? project._id.toString(), item._id.toString())
    ] ?? 'none';

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
                isExpanded={isExpanded}
                onToggleExpand={() => toggleClientExpanded(clientId)}
                onClientClick={onClientClick}
                onProjectClick={onProjectClick}
                contentItems={contentItems}
                rangeStart={startDate}
                rangeEnd={endDate}
                currentDate={currentDate}
                onTaskClick={onTaskClick}
                onContentItemClick={onContentItemClick}
                taskSeenStatus={taskSeenStatus}
                contentSeenStatus={contentSeenStatus}
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
      getAccentColor={(entry) =>
        clientByProjectId.get(String(entry.project._id))?.color || '#3b82f6'
      }
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

    const today = new Date(startDate);
    today.setHours(0, 0, 0, 0);

    if (visibleRows.length === 0) {
      return (
        <div className="p-8 min-h-[600px]">
          <EmptyStateIllustration
            title="No clients in this period"
            description="Add a client or adjust your timeframe to see client activity."
          />
        </div>
      );
    }

    return (
      <div className="p-8 min-h-[600px]">
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Clients ({visibleRows.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleRows.map((row) => {
            const clientId = String(row.client._id);
            const isExpanded = expandedClients.has(clientId);
            const displayColor = row.client.color || '#3b82f6';
            return (
              <div
                key={clientId}
                className="p-6 rounded-lg border-2 border-border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl relative overflow-hidden"
                style={{
                  backgroundColor: `${displayColor}F0`,
                  borderColor: displayColor,
                }}
              >
                <CalendarCardHeader
                  name={row.client.name}
                  logo={row.client.logo}
                  color={displayColor}
                  progressPercent={row.progressPercent}
                  activeTaskCount={row.activeTaskCount}
                  activeContentCount={row.activeContentCount}
                  showTasks={true}
                  showContent={true}
                  isExpanded={isExpanded}
                  onToggleExpand={() => toggleClientExpanded(clientId)}
                  onTitleClick={() => onClientClick(row.client)}
                />
                {isExpanded ? (
                  <div className="mt-4 space-y-4">
                    {clientExpandSections(row).map((section) => {
                      const projectId = String(section.project._id);
                      const { merged } = buildProjectEntityRangeItems(
                        section.project,
                        contentItems,
                        today,
                        today,
                        currentDate
                      );
                      const displayList = merged.filter(isActiveMergedCalendarItem);
                      if (displayList.length === 0) return null;
                      return (
                        <div key={projectId}>
                          <h4 className="text-sm font-semibold text-text-primary mb-2 opacity-90">
                            {section.label}
                          </h4>
                          <CalendarExpandedRangeItems
                            project={section.project}
                            items={displayList}
                            keyPrefix={`${clientId}-${projectId}-today`}
                            onTaskClick={onTaskClick}
                            onContentItemClick={onContentItemClick}
                            getTaskSeenStatus={taskSeenStatus}
                            getContentSeenStatus={contentSeenStatus}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
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
      const weekStart = new Date(days[0]);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(days[6]);
      weekEnd.setHours(23, 59, 59, 999);
      const spanItems = collectUniqueSpanItemsForRange(
        weekStart,
        weekEnd,
        clientScopedProjects,
        contentItems,
        itemModeOptions
      );
      const layouts = layoutWeekSpanItems(days, spanItems, GANTT_ITEM_ROW_HEIGHT);
      const gridMinHeight = weekSpanGridMinHeight(layouts);

      return (
        <WeeklyDayGridShell
          startDate={startDate}
          minColumnHeight={gridMinHeight}
          overlay={
            spanItems.length === 0 ? (
              <div className="p-8">
                <EmptyStateIllustration
                  title="No tasks or content this week"
                  description="No client tasks or content are scheduled for this week."
                />
              </div>
            ) : (
              <WeeklyItemGanttOverlay
                layouts={layouts}
                renderBar={(layout) => {
                  const entry = spanItemToCalendarEntry(layout.item, layout.displayStart);
                  return (
                    <CalendarItemCardList
                      items={[entry]}
                      getSeenStatus={() => 'none'}
                      getTaskIndex={(e) => taskIndexForEntry(e)}
                      getClientBadge={getClientBadge}
                      getAccentColor={(e) =>
                        clientByProjectId.get(String(e.project._id))?.color || '#3b82f6'
                      }
                      onTaskClick={onTaskClick}
                      onContentItemClick={onContentItemClick}
                      variant="gantt"
                      className="h-full"
                    />
                  );
                }}
              />
            )
          }
        />
      );
    }

    const weekRows = clientsForRange(rows, startDate, endDate, allProjects, contentItems);
    const baseTop = 60;

    const cardHeights = weekRows.map((row) => {
      const clientId = String(row.client._id);
      const isExpanded = expandedClients.has(clientId);
      if (!isExpanded) return WEEKLY_HEADER_HEIGHT + 16;
      const projectCount = row.projects.length + (row.hubProject ? 1 : 0);
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
                      isExpanded={isExpanded}
                      onToggleExpand={() => toggleClientExpanded(clientId)}
                      onClientClick={onClientClick}
                      onProjectClick={onProjectClick}
                      compact
                      scheduledHoursOverride={row.scheduledHours}
                      contentItems={contentItems}
                      rangeStart={startDate}
                      rangeEnd={endDate}
                      currentDate={currentDate}
                      onTaskClick={onTaskClick}
                      onContentItemClick={onContentItemClick}
                      taskSeenStatus={taskSeenStatus}
                      contentSeenStatus={contentSeenStatus}
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
                      const bucketRow = clientRowForBucket(row, weekStart, weekEnd);
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
                            row={bucketRow}
                            isExpanded={isExpanded}
                            onToggleExpand={() => toggleClientExpanded(clientId)}
                            onClientClick={onClientClick}
                            onProjectClick={onProjectClick}
                            compact
                            scheduledHoursOverride={bucketRow.scheduledHours}
                            contentItems={contentItems}
                            rangeStart={weekStart}
                            rangeEnd={weekEnd}
                            currentDate={currentDate}
                            onTaskClick={onTaskClick}
                            onContentItemClick={onContentItemClick}
                            taskSeenStatus={taskSeenStatus}
                            contentSeenStatus={contentSeenStatus}
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
