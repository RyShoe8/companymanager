import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { buildClientImpactReport } from '@/lib/clients/buildClientImpactReport';
import type { IProject } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';

function project(partial: Partial<IProject> & { _id: string; name: string }): IProject {
  return partial as IProject;
}

describe('buildClientImpactReport', () => {
  const client = {
    _id: new Types.ObjectId(),
    name: 'Acme Corp',
    color: '#3b82f6',
  };

  it('excludes hub from active projects list', () => {
    const hub = project({
      _id: 'hub1',
      name: 'Acme Corp',
      projectType: 'client-admin',
      clientId: client._id,
      status: 'planning',
      tasks: [{ name: 'Hub task', status: 'active' }],
    });
    const deliverable = project({
      _id: 'del1',
      name: 'Website',
      projectType: 'client',
      clientId: client._id,
      status: 'in-development',
      tasks: [{ name: 'Build', status: 'active' }],
    });

    const report = buildClientImpactReport({
      client,
      projects: [hub, deliverable],
      contentItems: [],
      meetings: [],
      timeframe: 'monthly',
      referenceDate: new Date('2026-06-15'),
    });

    expect(report.projects).toHaveLength(1);
    expect(report.projects[0].id).toBe('del1');
  });

  it('filters completed tasks by completedAt in range', () => {
    const p = project({
      _id: 'p1',
      name: 'Project',
      projectType: 'client',
      clientId: client._id,
      tasks: [
        {
          _id: new Types.ObjectId(),
          name: 'Done in June',
          status: 'completed',
          completedAt: new Date('2026-06-10'),
          estimatedHours: 2,
        },
        {
          _id: new Types.ObjectId(),
          name: 'Done in May',
          status: 'completed',
          completedAt: new Date('2026-05-10'),
          estimatedHours: 5,
        },
      ],
    });

    const report = buildClientImpactReport({
      client,
      projects: [p],
      contentItems: [],
      meetings: [],
      timeframe: 'monthly',
      referenceDate: new Date('2026-06-15'),
    });

    expect(report.summary.tasksCompleted).toBe(1);
    expect(report.summary.hoursEstimated).toBe(2);
    expect(report.tasks[0].name).toBe('Done in June');
  });

  it('includes published content in range', () => {
    const projectId = new Types.ObjectId();
    const p = project({
      _id: projectId.toString(),
      name: 'Project',
      projectType: 'client',
      clientId: client._id,
    });
    const content = {
      _id: new Types.ObjectId(),
      projectId,
      title: 'Blog post',
      channel: 'Article',
      status: 'published',
      statusPublishedAt: new Date('2026-06-12'),
      estimatedHours: 3,
    } as IContentItem;

    const report = buildClientImpactReport({
      client,
      projects: [p],
      contentItems: [content],
      meetings: [],
      timeframe: 'monthly',
      referenceDate: new Date('2026-06-15'),
    });

    expect(report.summary.contentPublished).toBe(1);
    expect(report.summary.hoursEstimated).toBe(3);
  });
});
