import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), run: vi.fn() }));
vi.mock('@/lib/auth/requirePlatformAdmin', () => ({ requirePlatformAdmin: mocks.auth }));
vi.mock('@/lib/auth/middleware', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/ai/control/executionProbe', () => ({ readExecutionProbe: mocks.read, runExecutionProbe: mocks.run }));
import { GET, POST } from './route';
const request = (body: unknown = { confirm: true, kind: 'chat' }, origin = 'https://nucleas.test') => new Request('https://nucleas.test/api/admin/ai/connection-probe?kind=chat', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ error: null, user: { _id: 'admin' } }); mocks.read.mockResolvedValue({ outcome: 'not_started' }); mocks.run.mockResolvedValue({ outcome: 'http_success' }); });
describe('admin connection diagnostics', () => {
  it.each([401, 403])('denies unauthorized access %s', async status => {
    mocks.auth.mockResolvedValue({ error: NextResponse.json({}, { status }) });
    expect((await GET(request())).status).toBe(status); expect((await POST(request())).status).toBe(status);
    expect(mocks.run).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled();
  });
  it('rejects wrong origin, missing confirmation, unknown kind and arbitrary payload', async () => {
    expect((await POST(request({ confirm: true, kind: 'chat' }, 'https://other.test'))).status).toBe(403);
    for (const body of [{ kind: 'chat' }, { confirm: true, kind: 'execution' }, { confirm: true, kind: 'chat', endpoint: 'https://other.test' }]) {
      expect((await POST(request(body))).status).toBe(400);
    }
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it('passes authenticated actor and kind; GET is read-only and private', async () => {
    expect((await POST(request())).status).toBe(200); expect(mocks.run).toHaveBeenCalledWith('admin', 'chat');
    const response = await GET(request()); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mocks.read).toHaveBeenCalledWith('chat'); expect(mocks.run).toHaveBeenCalledTimes(1);
  });
});
