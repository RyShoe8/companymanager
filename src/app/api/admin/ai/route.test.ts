import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { defaultPlatformAiSettings } from '@/lib/ai/settingsSchema';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), save: vi.fn() }));
vi.mock('@/lib/auth/requirePlatformAdmin', () => ({ requirePlatformAdmin: mocks.auth }));
vi.mock('@/lib/auth/middleware', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/ai/control/settings', () => ({ platformSettingsId: 'platform-v1', readPlatformSettings: mocks.read, saveSettings: mocks.save }));
import { GET, PUT } from './route';
const body = { revision: 0, value: defaultPlatformAiSettings };
const request = (input: unknown = body, origin = 'https://nucleas.test') => new Request('https://nucleas.test/api/admin/ai', {
  method: 'PUT', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(input),
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ error: null, user: { _id: 'admin' } });
  mocks.read.mockResolvedValue(body);
  mocks.save.mockResolvedValue({ ...body, revision: 1 });
});
afterEach(() => vi.unstubAllEnvs());
describe('platform AI settings API', () => {
  it.each([401, 403])('rejects access with status %s before reading or saving settings', async status => {
    mocks.auth.mockResolvedValue({ error: NextResponse.json({}, { status }) });
    expect((await GET()).status).toBe(status); expect((await PUT(request())).status).toBe(status);
    expect(mocks.read).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it.each(['', 'https://evil.test'])('rejects missing or cross-site origins %s', async origin => {
    expect((await PUT(request(body, origin))).status).toBe(403); expect(mocks.save).not.toHaveBeenCalled();
  });
  it('returns only secret presence, never secret values', async () => {
    vi.stubEnv('NUCLEAS_AI_REMOTE_BEARER_TOKEN', 'do-not-reveal'); vi.stubEnv('CRON_SECRET', 'also-private');
    const response = await GET(); const text = await response.text();
    expect(text).not.toContain('do-not-reveal'); expect(text).not.toContain('also-private');
    expect(JSON.parse(text).secrets).toEqual({ bearerTokenConfigured: true, cronSecretConfigured: true });
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('requires confirmation before forwarding the existing credential to another endpoint', async () => {
    expect((await PUT(request({ ...body, value: { ...body.value, endpoint: 'https://other.example/chat' } }))).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('does not enable processing with missing server secrets', async () => {
    vi.stubEnv('NUCLEAS_AI_REMOTE_BEARER_TOKEN', '');
    expect((await PUT(request({ ...body, value: { ...body.value, remoteEnabled: true, dispatchEnabled: true,
      reservationMicros: 1, projectLimitMicros: 1, organizationLimitMicros: 1 } }))).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('reports stale edits without overwriting', async () => {
    mocks.save.mockResolvedValue(null);
    expect((await PUT(request())).status).toBe(409);
  });
  it('saves non-secret settings with actor and revision', async () => {
    expect((await PUT(request())).status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith('platform-v1', 0, body.value, 'admin');
  });
});
