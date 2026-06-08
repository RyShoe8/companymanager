import { describe, expect, it, vi } from 'vitest';
import {
  buildWorkspaceDeepLink,
  contentChanged,
  eventToDigestRow,
  groupDigestRowsByProject,
  isDigestDue,
  projectFieldsChanged,
  resolveContentRecipientEmployeeIds,
  resolveProjectRecipientEmployeeIds,
  resolveTaskRecipientEmployeeIds,
  taskChanged,
} from '@/lib/workspace/workspaceNotifications';
import type { WorkspaceDigestInterval } from '@/lib/workspace/notificationTypes';

describe('workspaceNotifications', () => {
  it('resolves task recipients from assignee ids', () => {
    const ids = resolveTaskRecipientEmployeeIds({
      assignedToEmployeeIds: ['emp-1', 'emp-2'],
    });
    expect(ids).toEqual(['emp-1', 'emp-2']);
  });

  it('resolves content recipient from assignee', () => {
    expect(resolveContentRecipientEmployeeIds({ assignedToEmployeeId: 'emp-3' })).toEqual(['emp-3']);
    expect(resolveContentRecipientEmployeeIds({})).toEqual([]);
  });

  it('resolves project recipients for managers on the team only', () => {
    const employeesById = new Map([
      ['mgr-1', { role: 'Manager' as const }],
      ['usr-1', { role: 'User' as const }],
    ]);
    const recipients = resolveProjectRecipientEmployeeIds(
      { assignedToEmployeeIds: ['mgr-1', 'usr-1'] },
      employeesById
    );
    expect(recipients).toEqual(['mgr-1']);
  });

  it('detects task and project field changes', () => {
    const beforeTask = { name: 'Draft', status: 'active', assignedToEmployeeIds: ['emp-1'] };
    const afterTask = { name: 'Draft', status: 'completed', assignedToEmployeeIds: ['emp-1'] };
    expect(taskChanged(beforeTask, afterTask)).toBe(true);
    expect(taskChanged(afterTask, afterTask)).toBe(false);

    const beforeProject = { name: 'Alpha', status: 'planning', assignedToEmployeeIds: ['mgr-1'] };
    const afterProject = { name: 'Beta', status: 'planning', assignedToEmployeeIds: ['mgr-1'] };
    expect(projectFieldsChanged(beforeProject, afterProject)).toBe(true);
  });

  it('detects content changes', () => {
    expect(contentChanged({ title: 'A' }, { title: 'B' })).toBe(true);
    expect(contentChanged({ title: 'A', status: 'planned' }, { title: 'A', status: 'planned' })).toBe(false);
  });

  it('builds workspace deep links', () => {
    expect(buildWorkspaceDeepLink({ baseUrl: 'https://nucleas.app', projectId: 'p1' })).toBe(
      'https://nucleas.app/workspace?project=p1'
    );
    expect(
      buildWorkspaceDeepLink({ baseUrl: 'https://nucleas.app', projectId: 'p1', taskId: 't1' })
    ).toBe('https://nucleas.app/workspace?project=p1&task=t1');
  });

  it('groups digest rows by project', () => {
    const rows = [
      eventToDigestRow(
        {
          eventType: 'task_new',
          projectId: 'p1',
          projectName: 'Project One',
          entityKind: 'task',
          entityId: 't1',
          entityLabel: 'Task A',
          changeLabel: 'New task assigned',
        },
        'https://nucleas.app'
      ),
      eventToDigestRow(
        {
          eventType: 'content_update',
          projectId: 'p1',
          projectName: 'Project One',
          entityKind: 'content',
          entityId: 'c1',
          entityLabel: 'Post',
          changeLabel: 'Content updated',
        },
        'https://nucleas.app'
      ),
    ];
    const grouped = groupDigestRowsByProject(rows);
    expect(grouped.get('p1')?.length).toBe(2);
  });

  it('applies digest interval throttling', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-04T12:00:00Z'));

    expect(isDigestDue('off', null, new Date())).toBe(false);
    expect(isDigestDue('immediate', null, new Date())).toBe(true);

    const lastSent = new Date('2026-06-04T11:30:00Z');
    expect(isDigestDue('1h' as WorkspaceDigestInterval, lastSent, new Date())).toBe(false);

    vi.setSystemTime(new Date('2026-06-04T12:05:00Z'));
    expect(isDigestDue('immediate', lastSent, new Date())).toBe(true);

    vi.useRealTimers();
  });
});
