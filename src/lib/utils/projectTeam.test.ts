import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import type { IEmployee } from '@/lib/models/Employee';
import {
  mergeProjectTeamWithClient,
  taskAssigneeSelectOptions,
  sanitizeTaskAssigneesForProjectTeam,
  getProjectTeamEmployeeIds,
} from '@/lib/utils/projectTeam';

const projectEmployeeId = new Types.ObjectId();
const clientEmployeeId = new Types.ObjectId();
const otherEmployeeId = new Types.ObjectId();

const employees = [
  { _id: projectEmployeeId, name: 'Project Member' },
  { _id: clientEmployeeId, name: 'Client Member' },
  { _id: otherEmployeeId, name: 'Other' },
] as IEmployee[];

describe('mergeProjectTeamWithClient', () => {
  it('returns project unchanged when no client is provided', () => {
    const project = { assignedToEmployeeIds: [projectEmployeeId] };
    expect(mergeProjectTeamWithClient(project)).toBe(project);
  });

  it('unions project and client team IDs', () => {
    const project = { assignedToEmployeeIds: [projectEmployeeId] };
    const client = { assignedToEmployeeIds: [clientEmployeeId] };
    const merged = mergeProjectTeamWithClient(project, client);
    const ids = getProjectTeamEmployeeIds(merged);
    expect(ids.has(projectEmployeeId.toString())).toBe(true);
    expect(ids.has(clientEmployeeId.toString())).toBe(true);
    expect(ids.size).toBe(2);
  });

  it('includes client assignees in task options when project team is empty', () => {
    const project = { assignedToEmployeeIds: [] };
    const client = { assignedToEmployeeIds: [clientEmployeeId] };
    const merged = mergeProjectTeamWithClient(project, client);
    const options = taskAssigneeSelectOptions(employees, merged);
    expect(options.map((o) => o.value)).toEqual([clientEmployeeId.toString()]);
  });

  it('keeps client-team assignee when sanitizing hub project with merged team', () => {
    const hubProject = { assignedToEmployeeIds: [] };
    const client = { assignedToEmployeeIds: [clientEmployeeId] };
    const merged = mergeProjectTeamWithClient(hubProject, client);
    const tasks = [
      {
        name: 'Hub task',
        assignedToEmployeeIds: [clientEmployeeId.toString()],
      },
    ];
    const { tasks: sanitized, stripped } = sanitizeTaskAssigneesForProjectTeam(merged, tasks);
    expect(stripped).toHaveLength(0);
    expect(sanitized[0].assignedToEmployeeIds).toEqual([clientEmployeeId.toString()]);
  });
});
