'use client';

import { useEffect, useState } from 'react';
import { IClient } from '@/lib/models/Client';
import { IProject } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { TimeframeType } from '@/lib/utils/dateUtils';
import { getCalendarPeriodTitle, navigateCalendarPeriod } from '@/lib/utils/calendarPeriodNav';
import CalendarPeriodHeader from '@/components/planning-map/CalendarPeriodHeader';
import {
  buildClientCalendarRows,
  sortClientRowsByActivity,
  type ClientCalendarProjectRow,
} from '@/lib/clients/clientCalendarData';
import { getProjectCardHeaderTextClass } from '@/lib/utils/colorContrast';
import EmptyStateIllustration from '@/components/ui/EmptyStateIllustration';
import Image from 'next/image';

function AnimatedProgressNumber({ target }: { target: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 600;
    const increment = target / (duration / 16);

    if (target === 0) {
      setValue(0);
      return;
    }

    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setValue(target);
        clearInterval(timer);
      } else {
        setValue(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [target]);

  return <>{value}</>;
}

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
  onDateChange: (date: Date) => void;
}

function ActiveStats({
  showTasks,
  showContent,
  activeTaskCount,
  activeContentCount,
  headerTextClass,
}: {
  showTasks: boolean;
  showContent: boolean;
  activeTaskCount: number;
  activeContentCount: number;
  headerTextClass: string;
}) {
  if (!showTasks && !showContent) return null;
  return (
    <div className={`flex flex-wrap gap-3 text-xs font-medium ${headerTextClass}`}>
      {showTasks && (
        <span>
          {activeTaskCount} active task{activeTaskCount === 1 ? '' : 's'}
        </span>
      )}
      {showContent && (
        <span>
          {activeContentCount} active content
        </span>
      )}
    </div>
  );
}

function ProgressBar({
  progressPercent,
  headerTextClass,
}: {
  progressPercent: number;
  headerTextClass: string;
}) {
  return (
    <div className="flex items-center gap-2 pr-4 mt-1">
      <div className={`relative h-1 flex-1 rounded-full overflow-hidden ${headerTextClass}`}>
        <div className="absolute inset-0 bg-white opacity-20" />
        <div
          className="relative h-full transition-all duration-500"
          style={{ width: `${progressPercent}%`, backgroundColor: 'currentColor' }}
        />
      </div>
      <span className={`text-[10px] font-bold ${headerTextClass} shrink-0`}>
        <AnimatedProgressNumber target={progressPercent} />%
      </span>
    </div>
  );
}

function ProjectCard({
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
      className="text-left p-4 rounded-lg border-2 border-border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg relative w-full"
      style={{
        backgroundColor: `${displayColor}F0`,
        borderColor: displayColor,
      }}
    >
      <div className="flex items-start gap-3 mb-2">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold overflow-hidden shrink-0 ${project.logo ? '' : headerTextClass}`}
          style={project.logo ? undefined : { backgroundColor: displayColor }}
        >
          {project.logo ? (
            <Image src={project.logo} alt="" width={32} height={32} className="w-full h-full object-cover" unoptimized />
          ) : (
            project.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h5 className={`text-sm font-bold truncate ${headerTextClass}`}>{project.name}</h5>
        </div>
      </div>
      <ProgressBar progressPercent={progressPercent} headerTextClass={headerTextClass} />
      <div className="mt-2">
        <ActiveStats
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
  onDateChange,
}: ClientCalendarViewProps) {
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

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
            {visibleRows.map((row) => {
              const {
                client,
                projects,
                activeTaskCount,
                activeContentCount,
                scheduledHours,
                progressPercent,
              } = row;
              const clientId = String(client._id);
              const isExpanded = expandedClients.has(clientId);
              const displayColor = client.color || '#3b82f6';
              const headerTextClass = getProjectCardHeaderTextClass(displayColor);

              return (
                <div
                  key={clientId}
                  className="rounded-lg border-2 border-border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl relative overflow-hidden"
                  style={{
                    backgroundColor: `${displayColor}F0`,
                    borderColor: displayColor,
                  }}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onClientClick(client)}
                        className="flex items-start gap-3 min-w-0 flex-1 text-left"
                      >
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
                          {scheduledHours > 0 ? (
                            <p className={`text-xs font-medium mt-1 ${headerTextClass} opacity-90`}>
                              Hours scheduled: {scheduledHours}h
                            </p>
                          ) : null}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleClientExpanded(clientId)}
                        className={`${headerTextClass} opacity-80 hover:opacity-100 transition-opacity shrink-0 p-1`}
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    </div>

                    <ProgressBar progressPercent={progressPercent} headerTextClass={headerTextClass} />

                    <div className="mt-2">
                      <ActiveStats
                        showTasks={showTasks}
                        showContent={showContent}
                        activeTaskCount={activeTaskCount}
                        activeContentCount={activeContentCount}
                        headerTextClass={headerTextClass}
                      />
                    </div>
                  </div>

                  {isExpanded && projects.length > 0 ? (
                    <div className="px-5 pb-5 pt-0 space-y-2 border-t border-white/20">
                      <p className={`text-xs font-semibold uppercase tracking-wide pt-3 ${headerTextClass} opacity-80`}>
                        Projects ({projects.length})
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {projects.map((projectRow) => (
                          <ProjectCard
                            key={String(projectRow.project._id)}
                            row={projectRow}
                            client={client}
                            showTasks={showTasks}
                            showContent={showContent}
                            onProjectClick={onProjectClick}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
