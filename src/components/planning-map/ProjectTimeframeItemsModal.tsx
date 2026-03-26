'use client';

import { IProject, IProjectTask } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { formatDate } from '@/lib/utils/dateUtils';
import Modal from '@/components/ui/Modal';

export interface TimeframeTaskItem {
  task: IProjectTask;
  startDate: Date;
  endDate: Date;
}

interface ProjectTimeframeItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: IProject | null;
  startDate: Date;
  endDate: Date;
  tasks: TimeframeTaskItem[];
  contentItems: IContentItem[];
  onContentItemClick?: (item: IContentItem) => void;
  /** Open project inspector focused on this task (parent resolves index and closes modal). */
  onTaskClick?: (task: IProjectTask) => void;
  getEmployeeName?: (id: string | undefined, name: string | undefined) => string | undefined;
}

export default function ProjectTimeframeItemsModal({
  isOpen,
  onClose,
  project,
  startDate,
  endDate,
  tasks,
  contentItems,
  onContentItemClick,
  onTaskClick,
  getEmployeeName = () => undefined,
}: ProjectTimeframeItemsModalProps) {
  if (!project) return null;

  const title = `${project.name} — ${formatDate(startDate)} – ${formatDate(endDate)}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="md">
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        {tasks.length === 0 && contentItems.length === 0 ? (
          <p className="text-text-secondary text-sm">No tasks or content in this period.</p>
        ) : (
          <>
            {tasks.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-2">Tasks</h3>
                <ul className="space-y-2">
                  {tasks.map(({ task }, idx) => (
                    <li key={`task-${idx}-${task.name}-${(task as any).startDate}`}>
                      <button
                        type="button"
                        onClick={() => onTaskClick?.(task)}
                        className="w-full text-left p-3 rounded border border-border bg-background-card hover:bg-background-card/80 transition-colors cursor-pointer"
                      >
                        <div className={`font-medium text-text-primary ${(task as any).status === 'completed' ? 'line-through opacity-60' : ''}`}>
                          {task.name}
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-text-secondary">
                          {(task as any).startDate && (task as any).endDate && (
                            <span>
                              {formatDate((task as any).startDate)} – {formatDate((task as any).endDate)}
                            </span>
                          )}
                          {getEmployeeName((task as any).assignedToEmployeeId?.toString(), (task as any).assignedTo) && (
                            <span>Assigned: {getEmployeeName((task as any).assignedToEmployeeId?.toString(), (task as any).assignedTo)}</span>
                          )}
                          {(task as any).status && <span className="capitalize">{(task as any).status}</span>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {contentItems.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-2">Content</h3>
                <ul className="space-y-2">
                  {contentItems.map((item) => (
                    <li
                      key={item._id.toString()}
                      className={`p-3 rounded border border-dashed border-border bg-background-card ${item.status === 'published' ? 'opacity-60' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => onContentItemClick?.(item)}
                        className="text-left w-full"
                      >
                        <span className="inline-block mr-2" aria-hidden>📝</span>
                        <span className={`font-medium text-text-primary ${item.status === 'published' ? 'line-through' : ''}`}>
                          {item.title}
                        </span>
                        <span className="ml-2 px-2 py-0.5 rounded text-xs bg-muted text-text-secondary">
                          {item.channel}
                        </span>
                      </button>
                      {item.publishDate && (
                        <div className="text-xs text-text-secondary mt-1">
                          Publish: {formatDate(item.publishDate)}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
