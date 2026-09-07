import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { defaultPlatformAiSettings } from '@/lib/ai/settingsSchema';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), settings: vi.fn(), find: vi.fn(), select: vi.fn(), lean: vi.fn() }));
vi.mock('@/lib/auth/requirePlatformAdmin', () => ({ requirePlatformAdmin: mocks.auth }));
vi.mock('@/lib/auth/middleware', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/ai/control/settings', () => ({ readPlatformSettings: mocks.settings }));
vi.mock('@/lib/models/AiControl', () => ({ AiDispatchUsage: { findById: mocks.find } }));
import { GET } from './route';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { _id: 'admin' } });
  mocks.settings.mockResolvedValue({ value: defaultPlatformAiSettings });
  mocks.find.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ lean: mocks.lean });
  mocks.lean.mockResolvedValue(null);
});
describe('administrator shared inference usage', () => {
  it.each([401, 403])('denies %s before reading global usage', async status => {
    mocks.auth.mockResolvedValue({ error: NextResponse.json({}, { status }) });
    expect((await GET()).status).toBe(status);
    expect(mocks.settings).not.toHaveBeenCalled(); expect(mocks.find).not.toHaveBeenCalled();
  });
  it('returns only bounded public summary fields with no-store', async () => {
    mocks.lean.mockResolvedValue({ day: '2000-01-01', attempts: 20, lastStartedAt: new Date(0), secret: 'private', _id: 'internal' });
    const response = await GET(); const body = await response.json();
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(body).toMatchObject({ attempts: 0, dailyLimit: 48, remaining: 48, processingEnabled: false });
    expect(Object.keys(body).sort()).toEqual(['asOf', 'utcDay', 'attempts', 'dailyLimit', 'remaining', 'lastAttemptAt', 'nextEligibleAt', 'processingEnabled'].sort());
  });
  it('sanitizes database failures', async () => {
    mocks.lean.mockRejectedValue(new Error('private connection details'));
    const response = await GET(); expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private connection');
  });
});
