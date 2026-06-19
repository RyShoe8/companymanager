import { describe, expect, it } from 'vitest';
import { buildMeetingAgenda } from '@/lib/scheduling/buildMeetingAgenda';
import type { IProject } from '@/lib/models/Project';

function projectWithTasks(tasks: IProject['tasks']): IProject {
  return {
    _id: 'proj1' as unknown as IProject['_id'],
    name: 'Test Project',
    tasks,
  } as IProject;
}

describe('buildMeetingAgenda', () => {
  const meeting = {
    title: 'Standup',
    start: new Date('2026-06-10T14:00:00.000Z'),
    end: new Date('2026-06-10T15:00:00.000Z'),
    agendaUrl: 'https://example.com/agenda/token',
  };

  it('excludes completed tasks from the meeting window', () => {
    const payload = buildMeetingAgenda(meeting, [
      projectWithTasks([
        {
          name: 'Done task',
          status: 'completed',
          startDate: new Date('2026-06-10T13:00:00.000Z'),
          endDate: new Date('2026-06-10T16:00:00.000Z'),
        },
        {
          name: 'Active task',
          status: 'active',
          startDate: new Date('2026-06-10T13:00:00.000Z'),
          endDate: new Date('2026-06-10T16:00:00.000Z'),
        },
      ]),
    ]);

    const tasks = payload.projects.flatMap((p) => p.tasks);
    expect(tasks.map((t) => t.name)).toEqual(['Active task']);
  });

  it('sorts project blocks by activity count', () => {
    const payload = buildMeetingAgenda(meeting, [
      {
        _id: 'quiet' as unknown as IProject['_id'],
        name: 'Quiet',
        tasks: [],
      } as IProject,
      projectWithTasks([
        {
          name: 'Active task',
          status: 'active',
          startDate: new Date('2026-06-10T13:00:00.000Z'),
          endDate: new Date('2026-06-10T16:00:00.000Z'),
        },
      ]),
    ]);

    expect(payload.projects[0]?.name).toBe('Test Project');
  });
});
