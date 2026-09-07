import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), diagnostics: vi.fn() }));
vi.mock('@/lib/auth/requirePlatformAdmin', () => ({ requirePlatformAdmin: mocks.auth }));
vi.mock('@/lib/auth/middleware', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/ai/control/diagnostics', () => ({ planningDiagnostics: mocks.diagnostics }));
import { GET } from './route';
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { _id: 'admin' } }); });
describe('planning diagnostics authorization', () => {
  it.each([401, 403])('denies %s before inspecting global jobs', async status => {
    mocks.auth.mockResolvedValue({ error: NextResponse.json({}, { status }) });
    expect((await GET()).status).toBe(status); expect(mocks.diagnostics).not.toHaveBeenCalled();
  });
  it('prevents caching diagnostics', async () => {
    mocks.diagnostics.mockResolvedValue({ queued: { count: 0, capped: false } });
    const response = await GET(); expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('does not leak database errors', async () => {
    mocks.diagnostics.mockRejectedValue(new Error('private database URI'));
    const response = await GET(); expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private database');
  });
});
