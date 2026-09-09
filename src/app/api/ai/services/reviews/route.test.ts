import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ connect: vi.fn(), authenticate: vi.fn(), record: vi.fn(), indexes: vi.fn() }));
vi.mock('@/lib/db/mongodb', () => ({ default: mocks.connect }));
vi.mock('@/lib/auth/middleware', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/ai/control/serviceIdentities', () => ({ authenticateServiceCredential: mocks.authenticate }));
vi.mock('@/lib/ai/control/artifactReviews', () => ({ recordArtifactReview: mocks.record }));
vi.mock('@/lib/ai/control/indexes', () => ({ ensureAiIndexes: mocks.indexes }));
import { AiHttpError } from '@/lib/ai/control/access';
import { POST } from './route';
const input = { grantId: 'a'.repeat(24), artifactId: 'b'.repeat(24), grantRevision: 0, review: { synthetic: true } };
const request = (body: unknown = input) => new Request('https://nucleas.test/api/ai/services/reviews', {
  method: 'POST', headers: { authorization: 'Bearer synthetic', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
beforeEach(() => { vi.resetAllMocks(); mocks.authenticate.mockResolvedValue({ identityId: 'reviewer' }); mocks.record.mockResolvedValue({ reviewId: 'review' }); });
describe('authenticated review submission', () => {
  it('authenticates before parsing or writing a review', async () => {
    mocks.authenticate.mockRejectedValue(new AiHttpError(401, 'Invalid credential.'));
    expect((await POST(request({ malformed: true }))).status).toBe(401);
    expect(mocks.record).not.toHaveBeenCalled(); expect(mocks.indexes).not.toHaveBeenCalled();
  });
  it.each([{ ...input, organizationId: 'forged' }, { ...input, grantRevision: -1 }, { ...input, artifactId: 'invalid' }])('rejects invalid envelopes', async body => {
    expect((await POST(request(body))).status).toBe(400); expect(mocks.record).not.toHaveBeenCalled();
  });
  it('passes the bearer to transactional authorization and disables response caching', async () => {
    const result = await POST(request());
    expect(result.status).toBe(201); expect(result.headers.get('cache-control')).toContain('no-store');
    expect(mocks.record).toHaveBeenCalledWith('Bearer synthetic', input.grantId, 0, input.artifactId, input.review);
  });
  it('preserves transactional authorization denial', async () => {
    mocks.record.mockRejectedValue(new AiHttpError(403, 'Reviewer identity mismatch.'));
    expect((await POST(request())).status).toBe(403);
  });
  it('does not return private backend errors', async () => {
    mocks.record.mockRejectedValue(new Error('secret credential'));
    const result = await POST(request()); expect(result.status).toBe(503); expect(await result.text()).not.toContain('secret credential');
  });
});
