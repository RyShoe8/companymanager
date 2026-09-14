import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

vi.stubEnv('NEXTAUTH_SECRET', 'test-secret-for-balance-route');

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  loadCredentialBalances: vi.fn(),
  connectDB: vi.fn(async () => undefined),
}));

vi.mock('@/lib/auth/requirePlatformAdmin', () => ({ requirePlatformAdmin: mocks.auth }));
vi.mock('@/lib/auth/middleware', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/ai/rolePipeline/creditBalances', () => ({
  loadCredentialBalances: mocks.loadCredentialBalances,
}));
vi.mock('@/lib/db/mongodb', () => ({ default: mocks.connectDB }));

import { GET } from './route';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { _id: 'admin' } });
  mocks.loadCredentialBalances.mockResolvedValue({
    freePool: { limitMicros: 0, remainingMicros: 0, hint: '$0' },
    credentials: [],
    asOf: new Date().toISOString(),
  });
});

describe('GET /api/admin/ai/models/balances', () => {
  it.each([401, 403])('denies %s before loading balances', async (status) => {
    mocks.auth.mockResolvedValue({ error: NextResponse.json({}, { status }) });
    expect((await GET(new Request('https://nucleas.test/api/admin/ai/models/balances'))).status).toBe(
      status
    );
    expect(mocks.loadCredentialBalances).not.toHaveBeenCalled();
  });
});
