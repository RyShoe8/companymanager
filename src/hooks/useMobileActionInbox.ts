import type { IClient } from '@/lib/models/Client';
import type { IContentItem } from '@/lib/models/ContentItem';
import type { IProject } from '@/lib/models/Project';
import {
  collectWorkspaceItemObservations,
  observeItemsForUser,
  readObservedItemsForUser,
  buildTaskItemKey,
  buildContentItemKey,
} from '@/lib/workspace/itemSeenState';
import {
  getTaskAssigneeEmployeeIds,
  isEmployeeOnProjectTeam,
} from '@/lib/utils/projectTeam';
import {
  isActiveWorkspaceContent,
  isActiveWorkspaceTask,
} from '@/lib/workspace/activeWorkspaceItems';
import type { MobileInboxItem } from '@/contexts/MobileShellContext';

const NEW_PROJECT_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

type BuildInboxParams = {
  userId: string | null | undefined;
  employeeId: string | null | undefined;
  projects: IProject[];
  contentItems: IContentItem[];
  clients: IClient[];
  openProjectId?: string | null;
  onOpenTask: (projectId: string, taskId: string) => void;
  onOpenContent: (projectId: string, contentId: string) => void;
  onOpenProject: (projectId: string) => void;
  onOpenClient: (clientId: string) => void;
};

export function buildMobileActionInbox(params: BuildInboxParams): MobileInboxItem[] {
  const {
    userId,
    employeeId,
    projects,
    contentItems,
    clients,
    openProjectId,
    onOpenTask,
    onOpenContent,
    onOpenProject,
    onOpenClient,
  } = params;

  if (!userId || !employeeId) return [];

  const observations = collectWorkspaceItemObservations(projects, contentItems);
  observeItemsForUser(userId, observations, { openProjectId: openProjectId ?? undefined });
  const { statusByKey } = readObservedItemsForUser(
    userId,
    observations.map((o) => o.key)
  );

  const items: MobileInboxItem[] = [];
  const now = Date.now();

  for (const project of projects) {
    const projectId = project._id.toString();
    const onTeam = isEmployeeOnProjectTeam(project, employeeId);
    const createdMs = new Date(project.createdAt ?? 0).getTime();
    if (onTeam && Number.isFinite(createdMs) && now - createdMs < NEW_PROJECT_GRACE_MS) {
      items.push({
        id: `project:${projectId}`,
        label: project.name,
        type: 'project',
        status: 'new',
        onOpen: () => onOpenProject(projectId),
      });
    }

    (project.tasks ?? []).forEach((task, taskIndex) => {
      if (!isActiveWorkspaceTask(task)) return;
      const assignees = getTaskAssigneeEmployeeIds(task);
      if (!assignees.includes(employeeId)) return;
      const taskId = task._id?.toString() ?? null;
      if (!taskId) return;
      const key = buildTaskItemKey(projectId, taskId, taskIndex);
      const status = statusByKey[key];
      if (status !== 'new' && status !== 'updated') return;
      items.push({
        id: key,
        label: task.name || 'Untitled task',
        subtitle: project.name,
        type: 'task',
        status,
        onOpen: () => onOpenTask(projectId, taskId),
      });
    });
  }

  for (const content of contentItems) {
    if (!isActiveWorkspaceContent(content)) continue;
    const projectId = content.projectId?.toString();
    if (!projectId) continue;
    if (!projects.some((p) => p._id.toString() === projectId)) continue;
    if (content.assignedToEmployeeId?.toString() !== employeeId) continue;
    const key = buildContentItemKey(projectId, content._id.toString());
    const status = statusByKey[key];
    if (status !== 'new' && status !== 'updated') continue;
    const project = projects.find((p) => p._id.toString() === projectId);
    items.push({
      id: key,
      label: content.title || 'Untitled content',
      subtitle: project?.name,
      type: 'content',
      status,
      onOpen: () => onOpenContent(projectId, content._id.toString()),
    });
  }

  for (const client of clients) {
    const assigned = client.assignedToEmployeeIds?.map((id) => id.toString()) ?? [];
    const legacy = client.assignedToEmployeeId?.toString();
    const isAssigned =
      assigned.includes(employeeId) || (legacy != null && legacy === employeeId);
    if (!isAssigned) continue;
    const createdMs = new Date(client.createdAt ?? 0).getTime();
    if (!Number.isFinite(createdMs) || now - createdMs >= NEW_PROJECT_GRACE_MS) continue;
    items.push({
      id: `client:${client._id}`,
      label: client.name,
      type: 'client',
      status: 'new',
      onOpen: () => onOpenClient(client._id.toString()),
    });
  }

  const order = { new: 0, updated: 1 };
  items.sort((a, b) => order[a.status] - order[b.status] || a.label.localeCompare(b.label));
  return items;
}
