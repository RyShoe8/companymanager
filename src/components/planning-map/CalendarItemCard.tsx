'use client';

import type { CSSProperties } from 'react';
import type { IProject, IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import ItemSeenTag from '@/components/workspace/ItemSeenTag';
import type { ItemSeenStatus } from '@/lib/workspace/itemSeenState';
import type { CalendarItemEntry } from '@/lib/calendar/calendarItemMode';
import { getProjectCardHeaderTextClass } from '@/lib/utils/colorContrast';

export const CALENDAR_ITEM_ROW_HEIGHT = 140;
export const GANTT_ITEM_ROW_HEIGHT = 56;

type ClientBadge = { name: string; color?: string };

interface CalendarItemCardProps {
  entry: CalendarItemEntry;
  seenStatus?: ItemSeenStatus;
  clientBadge?: ClientBadge;
  projectName?: string;
  taskAssigneeLabel?: string;
  onTaskClick?: (project: IProject, taskIndex: number) => void;
  onContentItemClick?: (item: IContentItem) => void;
  taskIndex?: number;
  compact?: boolean;
  variant?: 'default' | 'gantt';
  accentColor?: string;
}

function ClientBadgePill({ badge, muted }: { badge: ClientBadge; muted?: boolean }) {
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full truncate max-w-full shrink-0 ${
        muted ? 'mb-0' : 'mb-1'
      }`}
      style={
        muted
          ? { backgroundColor: 'rgba(255,255,255,0.25)', color: 'inherit' }
          : {
              backgroundColor: badge.color ? `${badge.color}30` : undefined,
              color: badge.color ?? undefined,
            }
      }
    >
      {badge.name}
    </span>
  );
}

function cardSurfaceClass(accentColor?: string, headerTextClass?: string) {
  if (!accentColor) {
    return {
      className: 'border border-border bg-background-card',
      style: undefined as CSSProperties | undefined,
      textClass: '',
    };
  }
  return {
    className: `border-2 ${headerTextClass ?? ''}`,
    style: {
      backgroundColor: `${accentColor}F0`,
      borderColor: accentColor,
    } as CSSProperties,
    textClass: headerTextClass ?? '',
  };
}

export default function CalendarItemCard({
  entry,
  seenStatus = 'none',
  clientBadge,
  projectName,
  taskAssigneeLabel,
  onTaskClick,
  onContentItemClick,
  taskIndex = -1,
  compact = false,
  variant = 'default',
  accentColor,
}: CalendarItemCardProps) {
  const isGantt = variant === 'gantt';
  const height = isGantt ? GANTT_ITEM_ROW_HEIGHT : compact ? undefined : CALENDAR_ITEM_ROW_HEIGHT;
  const headerTextClass = accentColor ? getProjectCardHeaderTextClass(accentColor) : '';
  const surface = cardSurfaceClass(accentColor, headerTextClass);

  if (entry.type === 'task') {
    const task = entry.task;
    return (
      <button
        type="button"
        onClick={() => {
          if (taskIndex >= 0) onTaskClick?.(entry.project, taskIndex);
        }}
        className={`w-full h-full min-w-0 text-left overflow-hidden cursor-pointer transition-colors hover:opacity-90 ${surface.className} ${
          isGantt ? 'p-2 flex flex-col justify-center' : 'p-3 rounded hover:bg-background-card/80'
        }`}
        style={{ ...surface.style, ...(height && !isGantt ? { minHeight: height } : undefined) }}
      >
        {isGantt ? (
          <div className={`flex items-center gap-2 min-w-0 ${surface.textClass}`}>
            {clientBadge ? <ClientBadgePill badge={clientBadge} muted /> : null}
            <span
              className={`font-medium truncate text-sm ${task.status === 'completed' ? 'line-through opacity-60' : ''}`}
              title={task.name}
            >
              <ItemSeenTag status={seenStatus} />
              {task.name}
            </span>
          </div>
        ) : (
          <>
            {clientBadge ? <ClientBadgePill badge={clientBadge} /> : null}
            {projectName ? (
              <div className={`text-xs mb-1 truncate opacity-80 ${surface.textClass}`}>{projectName}</div>
            ) : null}
            <div
              className={`font-medium line-clamp-2 ${surface.textClass || 'text-text-primary'} ${
                task.status === 'completed' ? 'line-through opacity-60' : ''
              }`}
              title={task.name}
            >
              <ItemSeenTag status={seenStatus} />
              {task.name}
            </div>
            {!compact && task.description ? (
              <p className={`text-sm mt-1 max-h-10 overflow-hidden opacity-80 ${surface.textClass}`}>
                {task.description}
              </p>
            ) : null}
            <div className={`flex gap-2 mt-2 text-xs flex-wrap opacity-90 ${surface.textClass || 'text-text-secondary'}`}>
              {task.estimatedHours ? <span>{task.estimatedHours}h</span> : null}
              {taskAssigneeLabel ? <span>Assigned: {taskAssigneeLabel}</span> : null}
              <span className="capitalize">{task.status}</span>
            </div>
          </>
        )}
      </button>
    );
  }

  const content = entry.content;
  return (
    <div
      className={`h-full overflow-hidden ${surface.className} ${
        isGantt ? '' : 'p-3 rounded'
      } ${content.status === 'published' ? 'opacity-60' : ''}`}
      style={{ ...surface.style, ...(height && !isGantt ? { minHeight: height } : undefined) }}
    >
      <button
        type="button"
        onClick={() => onContentItemClick?.(content)}
        className={`text-left w-full h-full ${isGantt ? 'p-2 flex items-center gap-2 min-w-0' : ''}`}
      >
        {isGantt ? (
          <span
            className={`font-medium truncate text-sm ${surface.textClass} ${
              content.status === 'published' ? 'line-through' : ''
            }`}
            title={content.title}
          >
            <ItemSeenTag status={seenStatus} />
            {content.title}
          </span>
        ) : (
          <>
            {clientBadge ? <ClientBadgePill badge={clientBadge} /> : null}
            {projectName ? (
              <div className={`text-xs mb-1 truncate opacity-80 ${surface.textClass}`}>{projectName}</div>
            ) : null}
            <span
              className={`font-medium line-clamp-2 ${surface.textClass || 'text-text-primary'} ${
                content.status === 'published' ? 'line-through' : ''
              }`}
              title={content.title}
            >
              <ItemSeenTag status={seenStatus} />
              {content.title}
            </span>
            <span className="ml-2 px-2 py-0.5 rounded text-xs bg-muted text-text-secondary">
              {content.channel}
            </span>
          </>
        )}
      </button>
    </div>
  );
}

interface CalendarItemCardListProps {
  items: CalendarItemEntry[];
  getSeenStatus: (entry: CalendarItemEntry) => ItemSeenStatus;
  getTaskIndex?: (entry: CalendarItemEntry & { type: 'task' }) => number;
  getTaskAssigneeLabel?: (task: IProjectTask) => string | undefined;
  getClientBadge?: (entry: CalendarItemEntry) => ClientBadge | undefined;
  getAccentColor?: (entry: CalendarItemEntry) => string | undefined;
  showProjectName?: boolean;
  onTaskClick?: (project: IProject, taskIndex: number) => void;
  onContentItemClick?: (item: IContentItem) => void;
  compact?: boolean;
  variant?: 'default' | 'gantt';
  className?: string;
}

export function CalendarItemCardList({
  items,
  getSeenStatus,
  getTaskIndex,
  getTaskAssigneeLabel,
  getClientBadge,
  getAccentColor,
  showProjectName = false,
  onTaskClick,
  onContentItemClick,
  compact = false,
  variant = 'default',
  className = 'space-y-2',
}: CalendarItemCardListProps) {
  if (items.length === 0) return null;
  return (
    <div className={className}>
      {items.map((entry, idx) => (
        <CalendarItemCard
          key={
            entry.type === 'task'
              ? `task-${entry.project._id}-${entry.task._id?.toString() ?? entry.task.name}-${idx}`
              : `content-${entry.content._id}-${idx}`
          }
          entry={entry}
          seenStatus={getSeenStatus(entry)}
          clientBadge={getClientBadge?.(entry)}
          accentColor={getAccentColor?.(entry)}
          projectName={showProjectName ? entry.project.name : undefined}
          taskAssigneeLabel={
            entry.type === 'task' ? getTaskAssigneeLabel?.(entry.task) : undefined
          }
          taskIndex={entry.type === 'task' ? getTaskIndex?.(entry) ?? -1 : undefined}
          onTaskClick={onTaskClick}
          onContentItemClick={onContentItemClick}
          compact={compact}
          variant={variant}
        />
      ))}
    </div>
  );
}

export function getProjectItemColor(project: IProject): string {
  return project.status === 'in-review' ? '#ef4444' : project.color || '#3b82f6';
}
