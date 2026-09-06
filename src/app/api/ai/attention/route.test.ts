import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), project: vi.fn(), list: vi.fn(), ack: vi.fn(), indexes: vi.fn() }));
vi.mock('@/lib/ai/control/attention', async () => ({ requireAttentionAccess: mocks.auth, listAttention: mocks.list, acknowledgeRun: mocks.ack,
  attentionFilterSchema: (await import('zod')).z.enum(['all', 'review', 'issues']) }));
vi.mock('@/lib/ai/control/access', () => ({ requireAiProject: mocks.project, AiHttpError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
vi.mock('@/lib/ai/control/indexes', () => ({ ensureAiIndexes: mocks.indexes }));
import { AiHttpError } from '@/lib/ai/control/access';
import { GET, POST } from './route';
const body = { projectId: 'a'.repeat(24), runId: 'b'.repeat(24), revision: 0 };
const request = (method = 'GET', input: unknown = body) => new NextRequest('https://nucleas.test/api/ai/attention', {
  method, headers: { origin: 'https://nucleas.test', 'Content-Type': 'application/json' }, ...(method === 'GET' ? {} : { body: JSON.stringify(input) }),
});
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ userId: 'actor' }); mocks.project.mockResolvedValue({ userId: 'actor', canManage: false });
  mocks.list.mockResolvedValue({ items: [], nextCursor: null, canManage: false }); mocks.ack.mockResolvedValue({ acknowledged: true });
});
describe('attention API', () => {
  it.each([401, 403])('denies unauthenticated or unscoped requests with %s', async status => {
    mocks.auth.mockRejectedValue(new AiHttpError(status, 'Denied'));
    expect((await GET(request())).status).toBe(status); expect((await POST(request('POST'))).status).toBe(status);
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.ack).not.toHaveBeenCalled();
  });
  it('does not cache attention snapshots', async () => {
    expect((await GET(request())).headers.get('cache-control')).toContain('no-store');
  });
  it('rechecks project permissions and origin before acknowledging', async () => {
    const req = request('POST'); expect((await POST(req)).status).toBe(200);
    expect(mocks.project).toHaveBeenCalledWith(req, body.projectId, false, true);
    expect(mocks.ack).toHaveBeenCalledWith({ userId: 'actor', canManage: false }, body.runId, 0);
    mocks.project.mockRejectedValue(new AiHttpError(403, 'Invalid origin.'));
    mocks.ack.mockClear(); expect((await POST(request('POST'))).status).toBe(403); expect(mocks.ack).not.toHaveBeenCalled();
  });
  it('rejects forged actor fields and invalid revisions', async () => {
    expect((await POST(request('POST', { ...body, userId: 'victim' }))).status).toBe(400);
    expect((await POST(request('POST', { ...body, revision: -1 }))).status).toBe(400);
    expect(mocks.ack).not.toHaveBeenCalled();
  });
});
