import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ access: vi.fn(), history: vi.fn() }));
vi.mock('@/lib/ai/control/budgetSettings', () => ({ requireBudgetAccess: mocks.access }));
vi.mock('@/lib/ai/control/budgetHistory', () => ({ budgetHistory: mocks.history }));
vi.mock('@/lib/auth/middleware', () => ({ requireAuth: vi.fn() }));
import { AiHttpError } from '@/lib/ai/control/access';
import { GET } from './route';
beforeEach(() => { vi.resetAllMocks(); mocks.access.mockResolvedValue({ organizationId: 'verified-org', projectId: 'verified-project' }); });
describe('scoped monthly history API', () => {
  it.each([401, 403, 404])('denies %s before reading balances', async status => {
    mocks.access.mockRejectedValue(new AiHttpError(status, 'Denied'));
    expect((await GET(new NextRequest('https://nucleas.test/api/ai/budgets/history'))).status).toBe(status);
    expect(mocks.history).not.toHaveBeenCalled();
  });
  it('uses verified scope and prevents caching', async () => {
    mocks.history.mockResolvedValue({ items: [], nextCursor: null });
    const response = await GET(new NextRequest('https://nucleas.test/api/ai/budgets/history?organizationId=other&before=2026-01'));
    expect(mocks.history).toHaveBeenCalledWith('verified-org', 'verified-project', '2026-01');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('sanitizes database failures', async () => {
    mocks.history.mockRejectedValue(new Error('private URI'));
    const response = await GET(new NextRequest('https://nucleas.test/api/ai/budgets/history'));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('private URI');
  });
});
