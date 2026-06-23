'use client';

import type { IProject } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';
import type { IProjectTask } from '@/lib/models/Project';
import { resolveTaskIndexInProject } from '@/lib/utils/resolveTaskIndex';
import ItemSeenTag from '@/components/workspace/ItemSeenTag';
import type { ItemSeenStatus } from '@/lib/workspace/itemSeenState';
import type { MergedCalendarItem } from '@/lib/calendar/mergedCalendarItems';

export const RANGE_ITEM_ROW_HEIGHT = 76;

interface CalendarExpandedRangeItemsProps {
  project: IProject;
  items: MergedCalendarItem[];
  keyPrefix: string;
  onTaskClick?: (project: IProject, taskIndex: number) => void;
  onContentItemClick?: (item: IContentItem) => void;
  getTaskSeenStatus?: (project: IProject, task: IProjectTask) => ItemSeenStatus;
  getContentSeenStatus?: (project: IProject, item: IContentItem) => ItemSeenStatus;
  formatTaskAssigneeLabel?: (task: IProjectTask) => string | undefined;
}

export default function CalendarExpandedRangeItems({
  project,
  items,
  keyPrefix,
  onTaskClick,
  onContentItemClick,
  getTaskSeenStatus,
  getContentSeenStatus,
  formatTaskAssigneeLabel,
}: CalendarExpandedRangeItemsProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        if (item.type === 'task') {
          const task = item.task;
          const tIdx = resolveTaskIndexInProject(project, task);
          return (
            <button
              key={`${keyPrefix}-task-${idx}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (tIdx >= 0) onTaskClick?.(project, tIdx);
              }}
              className="w-full min-w-0 text-left p-2 rounded border border-border bg-background-card hover:bg-background-card/80 transition-colors cursor-pointer overflow-hidden flex flex-col justify-center"
              style={{ height: RANGE_ITEM_ROW_HEIGHT }}
            >
              <div
                className={`font-medium text-text-primary truncate text-sm ${task.status === 'completed' ? 'line-through opacity-60' : ''}`}
                title={task.name}
              >
                {getTaskSeenStatus ? (
                  <ItemSeenTag status={getTaskSeenStatus(project, task)} />
                ) : null}
                {task.name}
              </div>
              <div className="flex gap-2 mt-1 text-xs text-text-secondary flex-wrap">
                {task.estimatedHours ? <span>{task.estimatedHours}h</span> : null}
                {formatTaskAssigneeLabel?.(task) ? (
                  <span className="truncate">{formatTaskAssigneeLabel(task)}</span>
                ) : null}
                <span className="capitalize shrink-0">{task.status}</span>
              </div>
            </button>
          );
        }
        const c = item.content;
        return (
          <div
            key={c._id.toString()}
            className={`p-2 rounded border border-dashed border-border bg-background-card overflow-hidden flex flex-col justify-center ${c.status === 'published' ? 'opacity-60' : ''}`}
            style={{ height: RANGE_ITEM_ROW_HEIGHT }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onContentItemClick?.(c);
              }}
              className="text-left w-full h-full flex flex-col justify-center min-w-0"
            >
              <span
                className={`font-medium text-text-primary truncate text-sm ${c.status === 'published' ? 'line-through' : ''}`}
                title={c.title}
              >
                {getContentSeenStatus ? (
                  <ItemSeenTag status={getContentSeenStatus(project, c)} />
                ) : null}
                {c.title}
              </span>
              <span className="mt-1 px-1.5 py-0.5 rounded text-xs bg-muted text-text-secondary w-fit">
                {c.channel}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
