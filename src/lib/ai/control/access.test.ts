import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
const mocks = vi.hoisted(() => ({
  auth: vi.fn(), user: vi.fn(), employee: vi.fn(), project: vi.fn(), orgIds: vi.fn(), enabled: vi.fn(), db: vi.fn(),
}));
vi.mock('@/lib/auth/middleware', () => ({ requireAuth: mocks.auth }));
vi.mock('@/lib/db/mongodb', () => ({ default: mocks.db }));
vi.mock('@/lib/models/User', () => ({ default: { findById: () => ({ select: () => ({ lean: mocks.user }) }) } }));
vi.mock('@/lib/models/Employee', () => ({ default: { findOne: () => ({ lean: mocks.employee }) } }));
vi.mock('@/lib/models/Project', () => ({ default: { findOne: mocks.project } }));
vi.mock('@/lib/utils/apiHelpers', () => ({ getOrganizationUserIds: mocks.orgIds }));
vi.mock('./config', () => ({ isAiPlanningEnabled: mocks.enabled }));
import { requireAiProject } from './access';

const projectId = 'a'.repeat(24);
const req = (method = 'GET', origin = 'https://nucleas.test') => new NextRequest(`https://nucleas.test/api/projects/${projectId}/ai`, { method, headers: { origin } });
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ userId: 'u' });
  mocks.user.mockResolvedValue({ organizationId: 'org-a' }); mocks.enabled.mockReturnValue(true);
  mocks.employee.mockResolvedValue({ _id: 'employee-a', role: 'User' });
  mocks.orgIds.mockResolvedValue(['owner-a']); mocks.project.mockResolvedValue({ assignedToEmployeeIds: ['employee-a'] });
});
describe('AI project authorization', () => {
  it('rejects unauthenticated access before database queries', async () => {
    mocks.auth.mockResolvedValue(NextResponse.json({}, { status: 401 }));
    await expect(requireAiProject(req(), projectId)).rejects.toMatchObject({ status: 401 });
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it('fails closed when planning is disabled', async () => {
    mocks.enabled.mockReturnValue(false);
    await expect(requireAiProject(req(), projectId)).rejects.toMatchObject({ status: 404 });
    expect(mocks.project).not.toHaveBeenCalled();
  });
  it('uses organization-scoped ownership, not an unscoped project lookup', async () => {
    await requireAiProject(req(), projectId);
    expect(mocks.project).toHaveBeenCalledWith({ _id: projectId, userId: { $in: ['owner-a'] } });
  });
  it('does not reveal another organization project', async () => {
    mocks.project.mockResolvedValue(null);
    await expect(requireAiProject(req(), projectId)).rejects.toMatchObject({ status: 404 });
  });
  it('requires project contribution permission', async () => {
    mocks.project.mockResolvedValue({ assignedToEmployeeIds: ['someone-else'] });
    await expect(requireAiProject(req(), projectId)).rejects.toMatchObject({ status: 404 });
  });
  it('requires a manager for approval', async () => {
    await expect(requireAiProject(req('POST'), projectId, true)).rejects.toMatchObject({ status: 403 });
    mocks.employee.mockResolvedValue({ _id: 'employee-a', role: 'Manager' });
    await expect(requireAiProject(req('POST'), projectId, true)).resolves.toMatchObject({ canManage: true });
  });
  it.each(['https://evil.test', ''])('rejects cross-origin/missing-origin mutations', async origin => {
    await expect(requireAiProject(req('POST', origin), projectId)).rejects.toMatchObject({ status: 403 });
  });
});
