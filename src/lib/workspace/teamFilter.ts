import { IProjectTask } from '@/lib/models/Project';
import { IContentItem } from '@/lib/models/ContentItem';
import { IEmployee } from '@/lib/models/Employee';
import { TeamFilterType } from '@/components/workspace/WorkspaceTeamFilter';

function getTaskAssigneeEmployeeIds(task: IProjectTask): string[] {
  if (Array.isArray(task.assignedToEmployeeIds)) {
    return task.assignedToEmployeeIds
      .map((id) => id?.toString())
      .filter((id): id is string => Boolean(id));
  }
  const single = task.assignedToEmployeeId?.toString();
  return single ? [single] : [];
}

export function passesTeamFilter(
  item: IProjectTask | IContentItem,
  teamFilter: TeamFilterType,
  employees: IEmployee[]
): boolean {
  if (teamFilter === 'All Teams') return true;

  let assignedIds: string[] = [];

  if ('status' in item && 'name' in item && !('title' in item)) {
    // It's a task
    assignedIds = getTaskAssigneeEmployeeIds(item as IProjectTask);
  } else {
    // It's a content item
    const content = item as IContentItem;
    if (content.assignedToEmployeeId) {
      assignedIds = [content.assignedToEmployeeId.toString()];
    }
  }

  // Hide unassigned items when a specific team is selected
  if (assignedIds.length === 0) return false;

  return assignedIds.some((id) => {
    const emp = employees.find((e) => e._id.toString() === id);
    if (!emp) return false;
    if (emp.role === 'Administrator' || emp.role === 'Manager') return true;
    return emp.team === teamFilter;
  });
}
