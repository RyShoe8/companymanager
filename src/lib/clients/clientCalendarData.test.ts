import { describe, expect, it } from 'vitest';
import { buildClientCalendarRows, clientExpandSections, recomputeClientRowForRange } from '@/lib/clients/clientCalendarData';
import type { IClient } from '@/lib/models/Client';
import type { IProject } from '@/lib/models/Project';
import type { IContentItem } from '@/lib/models/ContentItem';

function client(id: string, name: string): IClient {
  return { _id: id, name, color: '#3b82f6' } as IClient;
}

function project(partial: Partial<IProject> & { _id: string }): IProject {
  return partial as IProject;
}

const referenceDate = new Date('2026-06-10T12:00:00');

describe('buildClientCalendarRows', () => {
  it('counts hub-only tasks on the client card', () => {
    const clients = [client('c1', 'Acme')];
    const allProjects = [
      project({
        _id: 'hub1',
        clientId: 'c1',
        projectType: 'client-admin',
        name: 'Acme',
        status: 'planning',
        tasks: [
          {
            name: 'Client kickoff',
            startDate: '2026-06-10',
            endDate: '2026-06-12',
            status: 'active',
          },
        ],
      }),
    ];
    const rows = buildClientCalendarRows(clients, allProjects, [], 'weekly', referenceDate);
    expect(rows).toHaveLength(1);
    expect(rows[0].activeTaskCount).toBe(1);
    expect(rows[0].projects).toHaveLength(0);
    expect(rows[0].hubProject?.activeTaskCount).toBe(1);
    expect(rows[0].hasActivityInRange).toBe(true);
  });

  it('includes hub and delivery project counts without listing hub in projects', () => {
    const clients = [client('c1', 'Acme')];
    const allProjects = [
      project({
        _id: 'hub1',
        clientId: 'c1',
        projectType: 'client-admin',
        name: 'Acme',
        status: 'planning',
        tasks: [
          {
            name: 'Hub task',
            startDate: '2026-06-10',
            endDate: '2026-06-11',
            status: 'planning',
          },
        ],
      }),
      project({
        _id: 'p1',
        clientId: 'c1',
        projectType: 'client',
        name: 'Website',
        status: 'planning',
        tasks: [
          {
            name: 'Build page',
            startDate: '2026-06-10',
            endDate: '2026-06-15',
            status: 'active',
          },
        ],
      }),
    ];
    const rows = buildClientCalendarRows(clients, allProjects, [], 'weekly', referenceDate);
    expect(rows[0].activeTaskCount).toBe(2);
    expect(rows[0].projects).toHaveLength(1);
    expect(rows[0].projects[0].project._id).toBe('p1');
    expect(rows[0].hubProject?.activeTaskCount).toBe(1);
  });

  it('counts hub content on the client card', () => {
    const clients = [client('c1', 'Acme')];
    const allProjects = [
      project({
        _id: 'hub1',
        clientId: 'c1',
        projectType: 'client-admin',
        name: 'Acme',
        status: 'planning',
        tasks: [],
      }),
    ];
    const contentItems = [
      {
        _id: 'ci1',
        projectId: 'hub1',
        title: 'Blog post',
        channel: 'Article',
        status: 'planned',
        publishDate: '2026-06-11',
      },
    ] as IContentItem[];
    const rows = buildClientCalendarRows(
      clients,
      allProjects,
      contentItems,
      'weekly',
      referenceDate
    );
    expect(rows[0].activeContentCount).toBe(1);
    expect(rows[0].hubProject?.activeContentCount).toBe(1);
    expect(rows[0].hasActivityInRange).toBe(true);
  });

  it('counts open-ended hub tasks on the client card', () => {
    const clients = [client('c1', 'Acme')];
    const allProjects = [
      project({
        _id: 'hub1',
        clientId: 'c1',
        projectType: 'client-admin',
        name: 'Acme',
        status: 'planning',
        tasks: [
          {
            name: 'Ongoing retainer work',
            startDate: '2026-06-01',
            endDate: null,
            status: 'active',
          },
        ],
      }),
    ];
    const rows = buildClientCalendarRows(clients, allProjects, [], 'weekly', referenceDate);
    expect(rows).toHaveLength(1);
    expect(rows[0].activeTaskCount).toBe(1);
    expect(rows[0].hasActivityInRange).toBe(true);
    expect(rows[0].hubProject?.activeTaskCount).toBe(1);
  });
});

describe('recomputeClientRowForRange', () => {
  it('recomputes counts for a sub-range instead of keeping the parent timeframe totals', () => {
    const clients = [client('c1', 'Acme')];
    const allProjects = [
      project({
        _id: 'hub1',
        clientId: 'c1',
        projectType: 'client-admin',
        name: 'Acme',
        status: 'planning',
        tasks: [
          {
            name: 'Future kickoff',
            startDate: '2026-06-20',
            endDate: null,
            status: 'active',
          },
        ],
      }),
    ];
    const monthRow = buildClientCalendarRows(
      clients,
      allProjects,
      [],
      'monthly',
      referenceDate
    )[0];
    expect(monthRow.activeTaskCount).toBe(1);

    const weekStart = new Date('2026-06-08');
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date('2026-06-14');
    weekEnd.setHours(23, 59, 59, 999);

    const weekRow = recomputeClientRowForRange(
      monthRow,
      allProjects,
      [],
      weekStart,
      weekEnd,
      referenceDate
    );
    expect(weekRow.activeTaskCount).toBe(0);
    expect(weekRow.hubProject?.activeTaskCount).toBe(0);
  });
});

describe('clientExpandSections', () => {
  it('orders hub before delivery projects', () => {
    const hub = project({
      _id: 'hub1',
      clientId: 'c1',
      projectType: 'client-admin',
      name: 'Acme Hub',
      status: 'planning',
    });
    const delivery = project({
      _id: 'p1',
      clientId: 'c1',
      name: 'Website',
      status: 'active',
    });
    const row = buildClientCalendarRows(
      [client('c1', 'Acme')],
      [hub, delivery],
      [],
      'today',
      referenceDate
    )[0];

    const sections = clientExpandSections(row);
    expect(sections).toHaveLength(2);
    expect(sections[0].label).toBe('Client tasks');
    expect(String(sections[0].project._id)).toBe('hub1');
    expect(sections[1].label).toBe('Website');
    expect(String(sections[1].project._id)).toBe('p1');
  });
});
