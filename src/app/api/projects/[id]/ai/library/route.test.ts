import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ access: vi.fn(), list: vi.fn(), objective: vi.fn(), plan: vi.fn(), enabled: vi.fn() }));
vi.mock('@/lib/ai/control/access', () => ({ requireAiProject: mocks.access, AiHttpError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
vi.mock('@/lib/ai/control/libraryQueries', async () => {
  const { z } = await import('zod');
  return { libraryKindSchema: z.enum(['objectives', 'plans']), listLibrary: mocks.list, getLibraryObjective: mocks.objective, getLibraryPlan: mocks.plan };
});
vi.mock('@/lib/ai/control/config', () => ({ isAiPlanningEnabled: mocks.enabled }));
import { AiHttpError } from '@/lib/ai/control/access';
import { GET as list } from './route';
import { GET as detail } from './[kind]/[itemId]/route';
const id = 'a'.repeat(24), itemId = 'b'.repeat(24);
const context = { params: Promise.resolve({ id, kind: 'plans', itemId }) };
const request = (query = '') => new NextRequest(`https://nucleas.test/api/projects/${id}/ai/library${query}`);
beforeEach(() => {
  vi.resetAllMocks(); mocks.access.mockResolvedValue({ canManage: false, organizationId: 'org-a' });
  mocks.list.mockResolvedValue({ kind: 'plans', items: [], nextCursor: null });
  mocks.objective.mockResolvedValue({ id: itemId, title: 'Older objective' }); mocks.plan.mockResolvedValue({ id: itemId });
  mocks.enabled.mockResolvedValue(false);
});
describe('planning library authorization', () => {
  it.each([401, 403, 404])('rejects unauthorized reads before queries with status %s', async status => {
    mocks.access.mockRejectedValue(new AiHttpError(status, 'Denied'));
    expect((await list(request(), context)).status).toBe(status);
    expect((await detail(request(), context)).status).toBe(status);
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.plan).not.toHaveBeenCalled();
  });
  it('retains scoped read-only history when planning is disabled', async () => {
    const req = request('?kind=plans&cursor=opaque'); const response = await list(req, context);
    expect(mocks.access).toHaveBeenCalledWith(req, id, false, true);
    expect(mocks.list).toHaveBeenCalledWith({ canManage: false, organizationId: 'org-a' }, 'plans', 'opaque');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('rejects unsupported collections', async () => {
    expect((await list(request('?kind=users'), context)).status).toBe(400);
    expect((await detail(request(), { params: Promise.resolve({ id, kind: 'users', itemId }) })).status).toBe(400);
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.plan).not.toHaveBeenCalled();
  });
  it('returns scoped plan details and explicit disabled/read-only capability', async () => {
    const response = await detail(request(), context);
    expect(await response.json()).toMatchObject({ kind: 'plans', canManage: false, planningEnabled: false });
    expect(mocks.plan).toHaveBeenCalledWith({ canManage: false, organizationId: 'org-a' }, itemId);
    expect(mocks.objective).not.toHaveBeenCalled();
  });
  it('looks up older objectives only through the authenticated scope', async () => {
    await detail(request(), { params: Promise.resolve({ id, kind: 'objectives', itemId }) });
    expect(mocks.objective).toHaveBeenCalledWith({ canManage: false, organizationId: 'org-a' }, itemId);
    expect(mocks.plan).not.toHaveBeenCalled();
  });
});
