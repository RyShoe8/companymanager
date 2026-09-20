import { beforeEach, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
const mocks = vi.hoisted(() => ({auth: vi.fn(), fetch: vi.fn()}));
vi.mock('@/lib/auth/requirePlatformAdmin', () => ({requirePlatformAdmin: mocks.auth}));
vi.mock('@/lib/ai/pricing/liveCatalog', () => ({fetchPricingCatalog: mocks.fetch}));
import { GET } from './route';
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({error: null}); });
it.each([401, 403])('blocks %s before contacting the pricing source', async status => {
  mocks.auth.mockResolvedValue({error: NextResponse.json({}, {status})});
  expect((await GET()).status).toBe(status);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it('returns a non-cached snapshot', async () => {
  mocks.fetch.mockResolvedValue({fetchedAt: '2026-09-20T00:00:00Z', rows: []});
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(await response.json()).toEqual({fetchedAt: '2026-09-20T00:00:00Z', rows: []});
});
it('never exposes raw source errors or claims a failed refresh succeeded', async () => {
  mocks.fetch.mockRejectedValue(new Error('private upstream details'));
  const response = await GET();
  expect(response.status).toBe(502);
  const text = await response.text();
  expect(text).toContain('outdated');
  expect(text).not.toContain('private upstream');
});

