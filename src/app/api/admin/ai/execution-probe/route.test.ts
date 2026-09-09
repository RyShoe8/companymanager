import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), run: vi.fn() }));
vi.mock('@/lib/auth/requirePlatformAdmin', () => ({ requirePlatformAdmin: mocks.auth }));
vi.mock('@/lib/auth/middleware', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/ai/control/executionProbe', () => ({ readExecutionProbe: mocks.read, runExecutionProbe: mocks.run }));
import { GET, POST } from './route';
const request = (body: unknown = { confirm: true }, origin = 'https://nucleas.test') => new Request('https://nucleas.test/api/admin/ai/execution-probe', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ error: null, user: { _id: 'admin' } }); mocks.read.mockResolvedValue({ outcome: 'not_started' }); mocks.run.mockResolvedValue({ outcome: 'execution_not_confirmed' }); });
describe('admin probe API', () => {
  it.each([401, 403])('denies unauthorized access %s', async status => {
    mocks.auth.mockResolvedValue({ error: NextResponse.json({}, { status }) });
    expect((await GET()).status).toBe(status); expect((await POST(request())).status).toBe(status); expect(mocks.run).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled();
  });
  it('requires same-origin confirmation and rejects arbitrary code or destinations', async () => {
    expect((await POST(request({ confirm: true }, 'https://other.test'))).status).toBe(403);
    expect((await POST(request({ confirm: false }))).status).toBe(400);
    expect((await POST(request({ confirm: true, code: 'anything' }))).status).toBe(400);
    expect((await POST(request({ confirm: true, endpoint: 'https://other.test' }))).status).toBe(400);
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it('uses authenticated actor and private response', async () => {
    const response = await POST(request()); expect(response.status).toBe(200); expect(mocks.run).toHaveBeenCalledWith('admin'); expect(response.headers.get('cache-control')).toContain('no-store');
    await GET(); expect(mocks.run).toHaveBeenCalledTimes(1);
  });
});
