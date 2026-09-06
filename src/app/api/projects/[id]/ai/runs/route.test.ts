import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ access: vi.fn(), list: vi.fn(), detail: vi.fn(), events: vi.fn(), cancel: vi.fn() }));
vi.mock('@/lib/ai/control/access', () => ({ requireAiProject: mocks.access, AiHttpError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
vi.mock('@/lib/ai/control/runQueries', () => ({ listProjectRuns: mocks.list, getRunDetail: mocks.detail, getRunEvents: mocks.events }));
vi.mock('@/lib/ai/control/planningQueue', () => ({ cancelPlanning: mocks.cancel }));
import { AiHttpError } from '@/lib/ai/control/access';
import { GET as list } from './route';
import { GET as detail, POST as cancel } from './[runId]/route';
const id = 'a'.repeat(24), runId = 'b'.repeat(24);
const context = { params: Promise.resolve({ id, runId }) };
const request = (query = '', method = 'GET', body?: unknown) => new NextRequest(`https://nucleas.test/api/projects/${id}/ai/runs/${runId}${query}`,
  { method, headers: { origin: 'https://nucleas.test', 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
beforeEach(() => {
  vi.resetAllMocks(); mocks.access.mockResolvedValue({ organizationId: 'org-a', canManage: false });
  mocks.list.mockResolvedValue({ runs: [], nextCursor: null }); mocks.detail.mockResolvedValue({ run: { id: runId } });
  mocks.events.mockResolvedValue({ events: [], nextAfter: null }); mocks.cancel.mockResolvedValue({ status: 'cancelled' });
});
describe('run inspection routes', () => {
  it.each([401, 403, 404])('denies access before any run queries with %s', async status => {
    mocks.access.mockRejectedValue(new AiHttpError(status, 'Denied'));
    expect((await list(request(), context)).status).toBe(status);
    expect((await detail(request('?view=events'), context)).status).toBe(status);
    expect((await cancel(request('', 'POST', { action: 'cancel' }), context)).status).toBe(status);
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.events).not.toHaveBeenCalled(); expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it('keeps audit reads scoped while planning is disabled and disables caching', async () => {
    const req = request('?cursor=opaque'); const response = await list(req, context);
    expect(mocks.access).toHaveBeenCalledWith(req, id, false, true);
    expect(mocks.list).toHaveBeenCalledWith({ organizationId: 'org-a', canManage: false }, 'opaque');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('loads detail and events separately rather than fetching an unbounded log', async () => {
    await detail(request(), context); expect(mocks.detail).toHaveBeenCalled(); expect(mocks.events).not.toHaveBeenCalled();
    await detail(request('?view=events&after=49'), context);
    expect(mocks.events).toHaveBeenCalledWith({ organizationId: 'org-a', canManage: false }, runId, '49');
  });
  it('requires manager authorization for cancellation even when planning is disabled', async () => {
    const req = request('', 'POST', { action: 'cancel' }); await cancel(req, context);
    expect(mocks.access).toHaveBeenCalledWith(req, id, true, true);
    expect(mocks.cancel).toHaveBeenCalledWith({ organizationId: 'org-a', canManage: false }, runId);
  });
  it('rejects unsupported actions and malformed run IDs', async () => {
    expect((await cancel(request('', 'POST', { action: 'execute' }), context)).status).toBe(400);
    expect((await cancel(request('', 'POST', { action: 'cancel' }), { params: Promise.resolve({ id, runId: 'bad' }) })).status).toBe(404);
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
});
