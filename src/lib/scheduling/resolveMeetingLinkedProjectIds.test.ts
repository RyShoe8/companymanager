import { describe, expect, it } from 'vitest';
import { sortAgendaProjectBlocks } from '@/lib/scheduling/buildMeetingAgenda';
import { resolveMeetingLinkedProjectIds } from '@/lib/scheduling/resolveMeetingLinkedProjectIds';
import type { IProject } from '@/lib/models/Project';

describe('sortAgendaProjectBlocks', () => {
  it('orders blocks by in-window task and content count descending', () => {
    const sorted = sortAgendaProjectBlocks([
      { projectId: 'a', name: 'Quiet', tasks: [], contentItems: [] },
      { projectId: 'b', name: 'Busy', tasks: [{ taskId: '1', taskIndex: 0, name: 'T', startDate: '', endDate: '' }], contentItems: [{ contentItemId: '1', title: 'C' }] },
      { projectId: 'c', name: 'Medium', tasks: [{ taskId: '2', taskIndex: 0, name: 'T2', startDate: '', endDate: '' }], contentItems: [] },
    ]);
    expect(sorted.map((b) => b.projectId)).toEqual(['b', 'c', 'a']);
  });
});

describe('resolveMeetingLinkedProjectIds', () => {
  it('includes hub and active child projects for linked clients', () => {
    const hub = {
      _id: 'hub1',
      clientId: 'client1',
      projectType: 'client-admin',
      name: 'HQ',
    } as IProject;
    const child = {
      _id: 'child1',
      clientId: 'client1',
      status: 'in-development',
      name: 'Site',
    } as IProject;
    const ids = resolveMeetingLinkedProjectIds([], ['client1'], [hub, child]);
    expect(ids).toEqual(['hub1', 'child1']);
  });
});
