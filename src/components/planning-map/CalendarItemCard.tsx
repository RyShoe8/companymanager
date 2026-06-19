'use client';

import type { IProject, IProjectTask } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import ItemSeenTag from '@/components/workspace/ItemSeenTag';
import type { ItemSeenStatus } from '@/lib/workspace/itemSeenState';
import type { CalendarItemEntry } from '@/lib/calendar/calendarItemMode';

export const CALENDAR_ITEM_ROW_HEIGHT = 140;

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
}

function ClientBadgePill({ badge }: { badge: ClientBadge }) {
  return (
    <span
      className="inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-1 truncate max-w-full"
      style={{
        backgroundColor: badge.color ? `${badge.color}30` : undefined,
        color: badge.color ?? undefined,
      }}
    >
      {badge.name}
    </span>
  );
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
}: CalendarItemCardProps) {
  const height = compact ? undefined : CALENDAR_ITEM_ROW_HEIGHT;

  if (entry.type === 'task') {
    const task = entry.task;
    return (
      <button
        type="button"
        onClick={() => {
          if (taskIndex >= 0) onTaskClick?.(entry.project, taskIndex);
        }}
        className="w-full min-w-0 text-left p-3 rounded border border-border bg-background-card hover:bg-background-card/80 transition-colors cursor-pointer overflow-hidden"
        style={height ? { minHeight: height } : undefined}
      >
        {clientBadge ? <ClientBadgePill badge={clientBadge} /> : null}
        {projectName ? (
          <div className="text-xs text-text-muted mb-1 truncate">{projectName}</div>
        ) : null}
        <div
          className={`font-medium text-text-primary line-clamp-2 ${
            task.status === 'completed' ? 'line-through opacity-60' : ''
          }`}
          title={task.name}
        >
          <ItemSeenTag status={seenStatus} />
          {task.name}
        </div>
        {!compact && task.description ? (
          <p className="text-sm text-text-secondary mt-1 max-h-10 overflow-hidden">{task.description}</p>
        ) : null}
        <div className="flex gap-2 mt-2 text-xs text-text-secondary flex-wrap">
          {task.estimatedHours ? <span>{task.estimatedHours}h</span> : null}
          {taskAssigneeLabel ? <span>Assigned: {taskAssigneeLabel}</span> : null}
          <span className="capitalize">{task.status}</span>
        </div>
      </button>
    );
  }

  const content = entry.content;
  return (
    <div
      className={`p-3 rounded border border-dashed border-border bg-background-card overflow-hidden ${
        content.status === 'published' ? 'opacity-60' : ''
      }`}
      style={height ? { minHeight: height } : undefined}
    >
      <button
        type="button"
        onClick={() => onContentItemClick?.(content)}
        className="text-left w-full h-full"
      >
        {clientBadge ? <ClientBadgePill badge={clientBadge} /> : null}
        {projectName ? (
          <div className="text-xs text-text-muted mb-1 truncate">{projectName}</div>
        ) : null}
        <span
          className={`font-medium text-text-primary line-clamp-2 ${
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
  showProjectName?: boolean;
  onTaskClick?: (project: IProject, taskIndex: number) => void;
  onContentItemClick?: (item: IContentItem) => void;
  compact?: boolean;
  className?: string;
}

export function CalendarItemCardList({
  items,
  getSeenStatus,
  getTaskIndex,
  getTaskAssigneeLabel,
  getClientBadge,
  showProjectName = false,
  onTaskClick,
  onContentItemClick,
  compact = false,
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
          projectName={showProjectName ? entry.project.name : undefined}
          taskAssigneeLabel={
            entry.type === 'task' ? getTaskAssigneeLabel?.(entry.task) : undefined
          }
          taskIndex={entry.type === 'task' ? getTaskIndex?.(entry) ?? -1 : undefined}
          onTaskClick={onTaskClick}
          onContentItemClick={onContentItemClick}
          compact={compact}
        />
      ))}
    </div>
  );
}
