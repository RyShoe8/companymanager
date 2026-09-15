import { describe, expect, it } from 'vitest';
import { buildDioramaDesks, ideChatThreadCacheKey } from '@/lib/ide/ideChatThreadCache';
import { runSceneFromState } from '@/lib/ide/runScenePhases';

describe('ideChatThreadCacheKey', () => {
  it('keys worker modes by mode only', () => {
    expect(ideChatThreadCacheKey({ mode: 'product', modelProfileId: 'x', model: 'y' })).toBe(
      'worker:product'
    );
  });

  it('keys Direct by profile and model', () => {
    expect(
      ideChatThreadCacheKey({ mode: 'direct', modelProfileId: 'abc', model: 'o4-mini' })
    ).toBe('direct:abc:o4-mini');
  });
});

describe('buildDioramaDesks', () => {
  it('builds one Direct desk', () => {
    expect(
      buildDioramaDesks({ direct: true, directModelLabel: 'o4-mini', busy: true })
    ).toEqual([{ role: 'direct', modelLabel: 'o4-mini', active: true }]);
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
    expect(desks.find((d) => d.role === 'worker')?.active).toBe(false);
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
});
