import { describe, expect, it } from 'vitest';
import { buildDioramaDesks, ideChatThreadCacheKey } from '@/lib/ide/ideChatThreadCache';
import { runSceneFromState } from '@/lib/ide/runScenePhases';

describe('ideChatThreadCacheKey', () => {
  it('keys worker modes by project and mode', () => {
    expect(
      ideChatThreadCacheKey({ projectId: 'projA', mode: 'product', modelProfileId: 'x', model: 'y' })
    ).toBe('projA:worker:product');
    expect(
      ideChatThreadCacheKey({ projectId: 'projB', mode: 'product' })
    ).toBe('projB:worker:product');
  });

  it('keys Direct by project, profile, and model', () => {
    expect(
      ideChatThreadCacheKey({
        projectId: 'projA',
        mode: 'direct',
        modelProfileId: 'abc',
        model: 'o4-mini',
      })
    ).toBe('projA:direct:abc:o4-mini');
  });
});

describe('buildDioramaDesks', () => {
  it('builds one Direct desk', () => {
    expect(
      buildDioramaDesks({ direct: true, directModelLabel: 'o4-mini', busy: true })
    ).toEqual([{ role: 'direct', modelLabel: 'o4-mini', active: true, status: 'active' }]);
  });

  it('builds three team desks with the active stage lit when busy', () => {
    const desks = buildDioramaDesks({
      stages: { planner: 'gpt-a', worker: 'gpt-b', reviewer: 'gpt-c' },
      busy: true,
      activeStage: 'planner',
    });
    expect(desks).toHaveLength(3);
    expect(desks.map((d) => d.role)).toEqual(['planner', 'worker', 'reviewer']);
    expect(desks.find((d) => d.role === 'planner')?.active).toBe(true);
    expect(desks.find((d) => d.role === 'planner')?.status).toBe('active');
    expect(desks.find((d) => d.role === 'worker')?.active).toBe(false);
    expect(desks.find((d) => d.role === 'worker')?.status).toBe('idle');
  });

  it('marks finished stages as done while another is active', () => {
    const desks = buildDioramaDesks({
      stages: { planner: 'p', worker: 'w', reviewer: 'r' },
      busy: true,
      activeStage: 'reviewer',
      doneStages: ['worker'],
    });
    expect(desks.find((d) => d.role === 'worker')?.status).toBe('done');
    expect(desks.find((d) => d.role === 'reviewer')?.status).toBe('active');
    expect(desks.find((d) => d.role === 'planner')?.status).toBe('idle');
  });

  it('does not light planner or reviewer for chat-style worker stage', () => {
    const desks = buildDioramaDesks({
      stages: { planner: 'p', worker: 'w', reviewer: 'r' },
      busy: true,
      activeStage: 'worker',
    });
    expect(desks.find((d) => d.role === 'planner')?.active).toBe(false);
    expect(desks.find((d) => d.role === 'reviewer')?.active).toBe(false);
    expect(desks.find((d) => d.role === 'worker')?.active).toBe(true);
  });
});

describe('runSceneFromState desks', () => {
  it('labels idle with model names', () => {
    const desks = buildDioramaDesks({
      stages: { planner: 'p', worker: 'w', reviewer: 'r' },
    });
    expect(runSceneFromState({ busy: false, interactionMode: 'chat', desks }).label).toMatch(
      /standing by/
    );
  });

  it('labels busy with the active desk model', () => {
    const desks = buildDioramaDesks({
      direct: true,
      directModelLabel: 'o4-mini',
      busy: true,
    });
    expect(
      runSceneFromState({
        busy: true,
        interactionMode: 'chat',
        busyTick: 1,
        desks,
      }).label
    ).toMatch(/o4-mini typing/);
  });

  it('labels busy reviewer from live stage', () => {
    const desks = buildDioramaDesks({
      stages: { planner: 'p', worker: 'w', reviewer: 'Sol' },
      busy: true,
      activeStage: 'reviewer',
      doneStages: ['worker'],
    });
    expect(
      runSceneFromState({
        busy: true,
        interactionMode: 'build',
        busyTick: 1,
        desks,
        liveStage: 'reviewer',
      }).label
    ).toMatch(/Sol reviewing|Reviewer/i);
  });
});
