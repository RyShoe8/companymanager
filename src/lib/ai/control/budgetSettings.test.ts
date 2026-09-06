import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), employee: vi.fn(), project: vi.fn(), db: vi.fn() }));
vi.mock('@/lib/auth/middleware', () => ({ requireAuth: mocks.auth }));
vi.mock('@/lib/db/mongodb', () => ({ default: mocks.db }));
vi.mock('@/lib/models/User', () => ({ default: { findById: () => ({ select: () => ({ lean: mocks.user }) }) } }));
vi.mock('@/lib/models/Employee', () => ({ default: { findOne: (...args: unknown[]) => { mocks.employee(...args); return { select: () => ({ lean: async () => mocks.employee.mock.results.at(-1)?.value }) }; } } }));
vi.mock('./access', () => ({ requireAiProject: mocks.project, AiHttpError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
import { requireBudgetAccess } from './budgetSettings';
const request = (query = '', method = 'GET', origin = 'https://nucleas.test') => new NextRequest(`https://nucleas.test/api/ai/budgets${query}`, { method, headers: { origin } });
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ userId: 'user-a' });
  mocks.user.mockResolvedValue({ organizationId: 'org-a' }); mocks.employee.mockReturnValue({ role: 'Manager' });
  mocks.project.mockResolvedValue({ userId: 'user-a', organizationId: 'org-a' });
});
describe('organization budget authorization', () => {
  it('rejects unauthenticated requests before database work', async () => {
    mocks.auth.mockResolvedValue(NextResponse.json({}, { status: 401 }));
    await expect(requireBudgetAccess(request())).rejects.toMatchObject({ status: 401 }); expect(mocks.db).not.toHaveBeenCalled();
  });
  it('derives the organization from membership, not caller input', async () => {
    expect(await requireBudgetAccess(request('?organizationId=other'))).toMatchObject({ organizationId: 'org-a' });
    expect(mocks.employee).toHaveBeenCalledWith({ userId: 'user-a', organizationId: 'org-a' });
  });
  it('rejects ordinary members', async () => {
    mocks.employee.mockReturnValue({ role: 'User' });
    await expect(requireBudgetAccess(request())).rejects.toMatchObject({ status: 403 });
  });
  it('requires scoped project manager access even when planning is disabled', async () => {
    const req = request('?projectId=aaaaaaaaaaaaaaaaaaaaaaaa');
    await requireBudgetAccess(req);
    expect(mocks.project).toHaveBeenCalledWith(req, 'aaaaaaaaaaaaaaaaaaaaaaaa', true, true);
    mocks.project.mockRejectedValue({ status: 404 });
    await expect(requireBudgetAccess(req)).rejects.toMatchObject({ status: 404 });
  });
  it.each(['', 'https://evil.test'])('rejects unsafe mutation origin %s', async origin => {
    await expect(requireBudgetAccess(request('', 'PUT', origin))).rejects.toMatchObject({ status: 403 });
  });
});
