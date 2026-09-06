import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), employee: vi.fn(), owners: vi.fn(), db: vi.fn() }));
vi.mock('@/lib/auth/middleware', () => ({ requireAuth: mocks.auth }));
vi.mock('@/lib/db/mongodb', () => ({ default: mocks.db }));
vi.mock('@/lib/models/User', () => ({ default: { findById: () => ({ select: () => ({ lean: mocks.user }) }) } }));
vi.mock('@/lib/models/Employee', () => ({ default: { findOne: () => ({ select: () => ({ lean: mocks.employee }) }) } }));
vi.mock('@/lib/utils/apiHelpers', () => ({ getOrganizationUserIds: mocks.owners }));
import { requireAttentionAccess, encodeAttentionCursor, decodeAttentionCursor } from './attention';
const userId = 'a'.repeat(24), organizationId = 'org-a';
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('NEXTAUTH_SECRET', 'synthetic-cursor-secret');
  mocks.auth.mockResolvedValue({ userId }); mocks.user.mockResolvedValue({ organizationId });
  mocks.employee.mockResolvedValue({ _id: 'b'.repeat(24), role: 'User' }); mocks.owners.mockResolvedValue(['owner']);
});
afterEach(() => vi.unstubAllEnvs());
describe('attention authorization and private cursors', () => {
  it('authenticates before reading membership', async () => {
    mocks.auth.mockResolvedValue(NextResponse.json({}, { status: 401 }));
    await expect(requireAttentionAccess(new NextRequest('https://nucleas.test/api/ai/attention'))).rejects.toMatchObject({ status: 401 });
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it('derives organization and role from membership rather than query parameters', async () => {
    expect(await requireAttentionAccess(new NextRequest('https://nucleas.test/api/ai/attention?organizationId=other&canManage=true')))
      .toMatchObject({ userId, organizationId, canManage: false });
    expect(mocks.owners).toHaveBeenCalledWith(userId, organizationId);
  });
  it('fails closed without organization membership', async () => {
    mocks.user.mockResolvedValue(null);
    await expect(requireAttentionAccess(new NextRequest('https://nucleas.test/api/ai/attention'))).rejects.toMatchObject({ status: 403 });
  });
  it('encrypts IDs and binds continuation to user, organization, filter and expiry', () => {
    const value = { userId, organizationId, filter: 'all' as const, id: 'c'.repeat(24), createdAt: '2026-09-05T00:00:00.000Z', expiresAt: Date.now() + 60000 };
    const token = encodeAttentionCursor(value);
    expect(Buffer.from(token, 'base64url').toString('utf8')).not.toContain(value.id);
    expect(decodeAttentionCursor(token, { userId, organizationId }, 'all')).toEqual(value);
    expect(() => decodeAttentionCursor(token, { userId: 'd'.repeat(24), organizationId }, 'all')).toThrow();
    expect(() => decodeAttentionCursor(token, { userId, organizationId: 'other' }, 'all')).toThrow();
    expect(() => decodeAttentionCursor(token, { userId, organizationId }, 'review')).toThrow();
    expect(() => decodeAttentionCursor(encodeAttentionCursor({ ...value, expiresAt: Date.now() - 1 }), { userId, organizationId }, 'all')).toThrow();
    const bytes = Buffer.from(token, 'base64url'); bytes[30] ^= 1;
    expect(() => decodeAttentionCursor(bytes.toString('base64url'), { userId, organizationId }, 'all')).toThrow();
  });
  it.each(['', '!', 'a'.repeat(1025)])('rejects malformed cursors %s', token => {
    expect(() => decodeAttentionCursor(token, { userId, organizationId }, 'all')).toThrow();
  });
});
