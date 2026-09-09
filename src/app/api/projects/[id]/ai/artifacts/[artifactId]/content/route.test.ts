import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ access: vi.fn(), content: vi.fn() }));
vi.mock('@/lib/auth/middleware', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/ai/control/access', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/ai/control/access')>(), requireAiProject: mocks.access }));
vi.mock('@/lib/ai/control/artifactQueries', () => ({ getArtifactContent: mocks.content }));
import { AiHttpError } from '@/lib/ai/control/access';
import { GET } from './route';
const request = () => new NextRequest('https://nucleas.test/api/projects/project/ai/artifacts/artifact/content?offset=16384&evidence=digest&organizationId=foreign');
const context = { params: Promise.resolve({ id: 'project', artifactId: 'artifact' }) };
beforeEach(() => { vi.resetAllMocks(); mocks.access.mockResolvedValue({ organizationId: 'trusted' }); mocks.content.mockResolvedValue({ text: '<script>untrusted</script>' }); });
describe('artifact content API', () => {
  it.each([401, 403, 404])('denies inaccessible content %s before reading bytes', async status => {
    mocks.access.mockRejectedValue(new AiHttpError(status, 'Unavailable.'));
    expect((await GET(request(), context)).status).toBe(status); expect(mocks.content).not.toHaveBeenCalled();
  });
  it('uses current project access and returns private JSON, not executable HTML', async () => {
    const req = request(); const response = await GET(req, context);
    expect(mocks.access).toHaveBeenCalledWith(req, 'project', false, true);
    expect(mocks.content).toHaveBeenCalledWith({ organizationId: 'trusted' }, 'artifact', 'digest', 16384);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('content-type')).toContain('application/json');
  });
  it('does not disclose backend failures', async () => {
    mocks.content.mockRejectedValue(new Error('private artifact bytes'));
    const response = await GET(request(), context);
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('private artifact bytes');
  });
});
