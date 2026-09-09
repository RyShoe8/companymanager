import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), issue: vi.fn(), revoke: vi.fn(), indexes: vi.fn() }));
vi.mock('@/lib/auth/requirePlatformAdmin', () => ({ requirePlatformAdmin: mocks.auth }));
vi.mock('@/lib/auth/middleware', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/ai/control/indexes', () => ({ ensureAiIndexes: mocks.indexes }));
vi.mock('@/lib/ai/control/serviceIdentities', () => ({ listServiceGrants: mocks.list, issueServiceGrant: mocks.issue, revokeServiceGrant: mocks.revoke }));
import { GET, POST, DELETE } from './route';
const request = (method = 'GET', origin = 'https://nucleas.test') => new Request('https://nucleas.test/api/admin/ai/service-identities/grants?identityId=identity&before=cursor&organizationId=foreign', {
  method, headers: { origin, 'Content-Type': 'application/json' }, ...(method === 'GET' ? {} : { body: JSON.stringify({ grantId: 'grant', revision: 0 }) }),
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ error: null, user: { _id: 'admin', organizationId: 'org' } });
  mocks.list.mockResolvedValue({ items: [], nextCursor: null });
  mocks.issue.mockResolvedValue({ grantId: 'grant' }); mocks.revoke.mockResolvedValue({ revoked: true });
});
describe('scoped grant API', () => {
  it.each([401, 403])('denies unauthorized access %s before operations', async status => {
    mocks.auth.mockResolvedValue({ error: NextResponse.json({}, { status }) });
    expect((await GET(request())).status).toBe(status);
    expect((await POST(request('POST'))).status).toBe(status);
    expect((await DELETE(request('DELETE'))).status).toBe(status);
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.issue).not.toHaveBeenCalled(); expect(mocks.revoke).not.toHaveBeenCalled();
  });
  it.each(['', 'https://other.test'])('rejects mutation origin %s', async origin => {
    expect((await POST(request('POST', origin))).status).toBe(403);
    expect((await DELETE(request('DELETE', origin))).status).toBe(403);
    expect(mocks.indexes).not.toHaveBeenCalled();
  });
  it('uses authenticated scope and private responses', async () => {
    const result = await GET(request());
    expect(mocks.list).toHaveBeenCalledWith('org', 'identity', 'cursor');
    expect(result.headers.get('cache-control')).toContain('no-store');
    expect((await POST(request('POST'))).status).toBe(201);
    expect(mocks.issue).toHaveBeenCalledWith({ userId: 'admin', organizationId: 'org' }, { grantId: 'grant', revision: 0 });
    expect((await DELETE(request('DELETE'))).status).toBe(200);
    expect(mocks.revoke).toHaveBeenCalledWith({ userId: 'admin', organizationId: 'org' }, { grantId: 'grant', revision: 0 });
  });
  it('requires an organization for every operation', async () => {
    mocks.auth.mockResolvedValue({ error: null, user: { _id: 'admin' } });
    expect((await GET(request())).status).toBe(403);
    expect((await POST(request('POST'))).status).toBe(403);
    expect((await DELETE(request('DELETE'))).status).toBe(403);
  });
  it('sanitizes internal failures', async () => {
    mocks.issue.mockRejectedValue(new Error('private database value'));
    const result = await POST(request('POST'));
    expect(result.status).toBe(503); expect(await result.text()).not.toContain('private database value');
  });
});
