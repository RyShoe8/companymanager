import { describe, expect, it } from 'vitest';
import { sortAgendaProjectBlocks } from '@/lib/scheduling/buildMeetingAgenda';
import { resolveMeetingLinkedProjectIds } from '@/lib/scheduling/resolveMeetingLinkedProjectIds';
import Project from '@/lib/models/Project';
import { Types } from 'mongoose';

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
    const clientId = new Types.ObjectId();
    const hub = new Project({
      _id: new Types.ObjectId(),
      clientId,
      projectType: 'client-admin',
      name: 'HQ',
    });
    const child = new Project({
      _id: new Types.ObjectId(),
      clientId,
      status: 'in-development',
      name: 'Site',
    });
    const ids = resolveMeetingLinkedProjectIds([], [String(clientId)], [hub, child]);
    expect(ids).toEqual([String(hub._id), String(child._id)]);
  });
});
