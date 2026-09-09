import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), register: vi.fn(), change: vi.fn(), indexes: vi.fn() }));
vi.mock('@/lib/auth/requirePlatformAdmin', () => ({ requirePlatformAdmin: mocks.auth }));
vi.mock('@/lib/auth/middleware', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/ai/control/indexes', () => ({ ensureAiIndexes: mocks.indexes }));
vi.mock('@/lib/ai/control/serviceIdentities', () => ({ listServiceIdentities: mocks.list, registerServiceIdentity: mocks.register, changeServiceIdentity: mocks.change }));
import { GET, POST, PATCH } from './route';
const request = (method = 'POST', origin = 'https://nucleas.test') => new Request('https://nucleas.test/api/admin/ai/service-identities', {
  method, headers: { origin, 'Content-Type': 'application/json' }, ...(method === 'GET' ? {} : { body: JSON.stringify({ name: 'Reviewer', role: 'reviewer' }) }),
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ error: null, user: { _id: 'admin', organizationId: 'org' } });
  mocks.list.mockResolvedValue({ items: [], nextCursor: null });
  mocks.register.mockResolvedValue({ identityId: 'id', status: 'disabled' });
  mocks.change.mockResolvedValue({ identityId: 'id', credential: 'synthetic-one-time' });
});
describe('service identity administrator API', () => {
  it.each([401, 403])('denies unauthorized access (%s) before database operations', async status => {
    mocks.auth.mockResolvedValue({ error: NextResponse.json({}, { status }) });
    expect((await GET(request('GET'))).status).toBe(status);
    expect((await POST(request())).status).toBe(status);
    expect((await PATCH(request('PATCH'))).status).toBe(status);
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.register).not.toHaveBeenCalled(); expect(mocks.change).not.toHaveBeenCalled();
  });
  it.each(['', 'https://other.test'])('rejects invalid mutation origins %s', async origin => {
    expect((await POST(request('POST', origin))).status).toBe(403);
    expect((await PATCH(request('PATCH', origin))).status).toBe(403);
    expect(mocks.indexes).not.toHaveBeenCalled();
  });
  it('uses only the authenticated organization and keeps credential responses private', async () => {
    const listed = await GET(request('GET'));
    expect(mocks.list).toHaveBeenCalledWith('org', null);
    expect(listed.headers.get('cache-control')).toContain('no-store');
    expect((await POST(request())).status).toBe(201);
    expect(mocks.register).toHaveBeenCalledWith({ userId: 'admin', organizationId: 'org' }, { name: 'Reviewer', role: 'reviewer' });
    const rotated = await PATCH(request('PATCH'));
    expect(rotated.headers.get('cache-control')).toContain('no-store');
    expect(await rotated.json()).toMatchObject({ credential: 'synthetic-one-time' });
  });
  it('denies administrators without an organization', async () => {
    mocks.auth.mockResolvedValue({ error: null, user: { _id: 'admin' } });
    expect((await GET(request('GET'))).status).toBe(403);
    expect((await POST(request())).status).toBe(403);
    expect(mocks.register).not.toHaveBeenCalled();
  });
  it('does not expose database errors or credential material on failed mutations', async () => {
    mocks.change.mockRejectedValue(new Error('private-secret-material'));
    const result = await PATCH(request('PATCH'));
    expect(result.status).toBe(503);
    expect(await result.text()).not.toContain('private-secret-material');
  });
});
