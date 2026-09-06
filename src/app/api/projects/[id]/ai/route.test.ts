import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ access: vi.fn(), objective: vi.fn(), available: vi.fn() }));
vi.mock('@/lib/ai/control/access', () => ({ requireAiProject: mocks.access, AiHttpError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
vi.mock('@/lib/ai/control/libraryQueries', () => ({ getLibraryObjective: mocks.objective }));
vi.mock('@/lib/ai/control/config', () => ({ planningAvailability: mocks.available }));
vi.mock('@/lib/ai/control/plans', () => ({ approvePlan: vi.fn(), planDigest: vi.fn() }));
vi.mock('@/lib/ai/control/planningQueue', () => ({ cancelPlanning: vi.fn(), queuePlanning: vi.fn() }));
vi.mock('@/lib/ai/control/indexes', () => ({ ensureAiIndexes: vi.fn() }));
vi.mock('@/lib/models/AiControl', () => {
  const find = () => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => [] });
  return { AiObjective: { find }, AiPlan: { find }, AiRun: { find } };
});
import { AiHttpError } from '@/lib/ai/control/access';
import { GET } from './route';
const id = 'a'.repeat(24), objectiveId = 'b'.repeat(24);
const access = { organizationId: 'org-a', project: { _id: id, name: 'Project' }, canManage: true };
const context = { params: Promise.resolve({ id }) };
const request = (query = '') => new NextRequest(`https://nucleas.test/api/projects/${id}/ai${query}`);
beforeEach(() => {
  vi.resetAllMocks(); mocks.access.mockResolvedValue(access);
  mocks.objective.mockResolvedValue({ id: objectiveId, title: 'Older objective', outcome: 'Outcome', constraints: '', acceptanceCriteria: ['Done'] });
  mocks.available.mockResolvedValue({ enabled: false, model: null, reservationMicros: null });
});
describe('selecting historical objectives for planning', () => {
  it('loads the explicitly selected objective even outside the recent list', async () => {
    const response = await GET(request(`?objectiveId=${objectiveId}`), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ objectives: [], selectedObjective: { id: objectiveId, title: 'Older objective' } });
    expect(mocks.objective).toHaveBeenCalledWith(access, objectiveId);
  });
  it('fails the request rather than revealing an out-of-scope selected objective', async () => {
    mocks.objective.mockRejectedValue(new AiHttpError(404, 'Objective not found.'));
    expect((await GET(request(`?objectiveId=${objectiveId}`), context)).status).toBe(404);
    expect(mocks.available).not.toHaveBeenCalled();
  });
  it('does not add objective detail loading to lightweight run polling', async () => {
    expect((await GET(request(`?view=runs&objectiveId=${objectiveId}`), context)).status).toBe(200);
    expect(mocks.objective).not.toHaveBeenCalled(); expect(mocks.available).not.toHaveBeenCalled();
  });
});
