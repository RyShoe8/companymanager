'use client';

import type { IProject } from '@/lib/models/Project';
import ProjectTechStackBar from '@/components/projects/ProjectTechStackBar';
import ProjectMarketingStackBar from '@/components/projects/ProjectMarketingStackBar';
import CreateMenu from '@/components/workspace/CreateMenu';
import { getProjectStatusDisplayLabel } from '@/lib/utils/statusMapping';
import {
  MARKETING_EMPLOYEES,
  MARKETING_SMART_BUTTONS,
  MARKETING_TASK_ASSET_CHIPS,
  type MarketingSmartButton,
} from '@/lib/marketing/marketingFixtures';

const TASK_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: '#3b82f6' },
  'in-review': { label: 'In Review', color: '#f59e0b' },
  completed: { label: 'Completed', color: '#22c55e' },
};

const noopUpdate = async () => {};

type MarketingProjectInspectorPreviewProps = {
  project: IProject;
  smartButtons?: MarketingSmartButton[];
  showCreateMenu?: boolean;
  showTasks?: boolean;
  showLinkedAssets?: boolean;
};

const ASSET_CHIP_CLASS =
  'inline-flex items-center rounded-lg bg-primary/10 px-2 py-1 text-xs font-medium text-primary max-w-[220px] truncate';

export default function MarketingProjectInspectorPreview({
  project,
  smartButtons = MARKETING_SMART_BUTTONS,
  showCreateMenu = false,
  showTasks = true,
  showLinkedAssets = false,
}: MarketingProjectInspectorPreviewProps) {
  const tasks = (project.tasks ?? []).filter((t) => t.status !== 'completed').slice(0, 4);
  const assigneeName = (employeeId?: { toString(): string }) => {
    if (!employeeId) return 'Unassigned';
    const id = employeeId.toString();
    return MARKETING_EMPLOYEES.find((e) => e._id.toString() === id)?.name ?? 'Team member';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {showCreateMenu && (
        <div className="flex justify-end px-4 pt-3">
          <CreateMenu
            isManagerOrAdmin
            currentUserRole="Administrator"
            canCreateTaskOrContent
            onCreateProject={() => {}}
            onCreateTask={() => {}}
            onCreateContent={() => {}}
            onCreateMeeting={() => {}}
            onCreateScreenshot={() => {}}
            onCreateRecord={() => {}}
          />
        </div>
      )}

      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center text-lg font-bold text-nucleas-ink"
            style={{ backgroundColor: project.color }}
          >
            {project.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{project.name}</h3>
            <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{project.description}</p>
            <span className="inline-flex mt-2 text-xs font-medium px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200">
              {getProjectStatusDisplayLabel(project.status)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4 text-sm min-w-0 w-full">
          <ProjectTechStackBar
            techStack={project.techStack ?? []}
            isManagerOrAdmin={false}
            onUpdate={noopUpdate}
          />
          <ProjectMarketingStackBar
            marketingStack={project.marketingStack ?? []}
            isManagerOrAdmin={false}
            onUpdate={noopUpdate}
          />
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-2">
          {smartButtons.map((btn) => (
            <span
              key={btn.label}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm"
            >
              <span className="font-medium text-indigo-700 truncate max-w-[180px]">{btn.label}</span>
            </span>
          ))}
        </div>
      </div>

      {showTasks && (
        <div className="p-4">
          <div className="flex gap-2 mb-4 border-b border-gray-100 pb-2">
            <span className="text-sm font-medium px-2 py-1 rounded-md bg-gray-100 text-gray-900">
              Active ({tasks.length})
            </span>
            <span className="text-sm font-medium px-2 py-1 rounded-md text-gray-500">Completed</span>
          </div>
          <div className="divide-y divide-gray-100">
            {tasks.map((task, idx) => {
              const status = TASK_STATUS_LABELS[task.status ?? 'active'] ?? TASK_STATUS_LABELS.active;
              const assignee =
                task.assignedToEmployeeIds?.[0] ?? task.assignedToEmployeeId;
              const assetChips =
                showLinkedAssets && task.name ? MARKETING_TASK_ASSET_CHIPS[task.name] : undefined;
              return (
                <div key={`${task.name}-${idx}`} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{task.name}</p>
                      <p className="text-xs text-gray-500 mt-2 flex flex-wrap items-center gap-3">
                        <span>{task.estimatedHours ?? 0}h</span>
                        <span>{assigneeName(assignee as { toString(): string } | undefined)}</span>
                      </p>
                      {assetChips && assetChips.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {assetChips.map((label) => (
                            <span key={label} className={ASSET_CHIP_CLASS}>
                              {label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-900 shrink-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: status.color }}
                        aria-hidden
                      />
                      {status.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
