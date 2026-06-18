import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import {
  findLegacyDeliverableProject,
  mergeTasksPreservingIds,
  taskIdStrings,
} from '@/lib/clients/transitionClientHubWork';
import type { IProject, IProjectTask } from '@/lib/models/Project';
import type { IClient } from '@/lib/models/Client';

function project(partial: Partial<IProject> & { _id: string }): IProject {
  return partial as IProject;
}

function client(partial: Partial<IClient> & { _id: string; name: string }): IClient {
  return partial as IClient;
}

describe('findLegacyDeliverableProject', () => {
  it('matches client deliverable by clientId, projectType, and case-insensitive name', () => {
    const c = client({ _id: 'client1', name: 'Senior By Design' });
    const deliverable = project({
      _id: 'del1',
      name: '  senior by design  ',
      projectType: 'client',
      clientId: 'client1',
    });
    const hub = project({
      _id: 'hub1',
      name: 'Senior By Design',
      projectType: 'client-admin',
      clientId: 'client1',
    });
    const otherClient = project({
      _id: 'del2',
      name: 'Senior By Design',
      projectType: 'client',
      clientId: 'other',
    });

    expect(findLegacyDeliverableProject(c, [hub, deliverable, otherClient])?._id).toBe('del1');
  });

  it('returns null when name does not match', () => {
    const c = client({ _id: 'client1', name: 'Senior By Design' });
    const p = project({
      _id: 'del1',
      name: 'Different Name',
      projectType: 'client',
      clientId: 'client1',
    });
    expect(findLegacyDeliverableProject(c, [p])).toBeNull();
  });

  it('ignores client-admin projects', () => {
    const c = client({ _id: 'client1', name: 'Acme' });
    const hub = project({
      _id: 'hub1',
      name: 'Acme',
      projectType: 'client-admin',
      clientId: 'client1',
    });
    expect(findLegacyDeliverableProject(c, [hub])).toBeNull();
  });
});

describe('mergeTasksPreservingIds', () => {
  const taskId = new Types.ObjectId();

  it('preserves task _id and appends to hub tasks', () => {
    const hubTasks: IProjectTask[] = [{ _id: new Types.ObjectId(), name: 'Existing' }];
    const sourceTasks: IProjectTask[] = [
      { _id: taskId, name: 'Moved task', status: 'active' },
    ];

    const result = mergeTasksPreservingIds(hubTasks, sourceTasks);

    expect(result.movedCount).toBe(1);
    expect(result.sourceTasksCleared).toEqual([]);
    expect(result.hubTasks).toHaveLength(2);
    expect(result.hubTasks[1]._id?.toString()).toBe(taskId.toString());
    expect(result.hubTasks[1].name).toBe('Moved task');
  });

  it('returns zero moved when source is empty', () => {
    const result = mergeTasksPreservingIds([{ name: 'Only' }], []);
    expect(result.movedCount).toBe(0);
    expect(result.hubTasks).toHaveLength(1);
  });
});

describe('taskIdStrings', () => {
  it('collects valid ObjectId strings from tasks', () => {
    const id1 = new Types.ObjectId();
    const id2 = new Types.ObjectId();
    const ids = taskIdStrings([
      { _id: id1, name: 'A' },
      { name: 'No id' },
      { _id: id2, name: 'B' },
    ]);
    expect(ids).toEqual([id1.toString(), id2.toString()]);
  });
});

describe('transition idempotency (pure)', () => {
  it('empty source tasks imply nothing to merge', () => {
    const result = mergeTasksPreservingIds([], []);
    expect(result.movedCount).toBe(0);
    expect(result.hubTasks).toEqual([]);
  });
});
