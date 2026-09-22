import { beforeEach, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
const mocks = vi.hoisted(() => ({auth: vi.fn(), load: vi.fn()}));
vi.mock('@/lib/auth/requirePlatformAdmin', () => ({requirePlatformAdmin: mocks.auth}));
vi.mock('@/lib/ai/pricing/availablePricing.server', () => ({loadAvailableModelPricing: mocks.load}));
import { GET } from './route';
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({error: null}); });
it.each([401, 403])('blocks %s before contacting the pricing source', async status => {
  mocks.auth.mockResolvedValue({error: NextResponse.json({}, {status})});
  expect((await GET()).status).toBe(status);
  expect(mocks.load).not.toHaveBeenCalled();
});
it('returns only the available-provider snapshot without caching it', async () => {
  const snapshot = {fetchedAt: '2026-09-20T00:00:00Z', referencePricingAvailable: true, providers: []};
  mocks.load.mockResolvedValue(snapshot);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(await response.json()).toEqual(snapshot);
});
it('never exposes credential or provider errors', async () => {
  mocks.load.mockRejectedValue(new Error('private upstream details'));
  const response = await GET();
  expect(response.status).toBe(502);
  const text = await response.text();
  expect(text).toContain('configured credentials');
  expect(text).not.toContain('private upstream');
});
