import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const worker = vi.hoisted(() => vi.fn());
vi.mock('../../../../../services/ai-runtime/planningWorker', () => ({ processPlanningQueue: worker }));
import { GET } from './route';
afterEach(() => { vi.unstubAllEnvs(); worker.mockReset(); });
describe('planning cron authentication', () => {
  it('fails closed with no cron secret', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect((await GET(new NextRequest('https://nucleas.test/api/cron/ai-planning'))).status).toBe(401);
    expect(worker).not.toHaveBeenCalled();
  });
  it('rejects the model token as a substitute for the cron secret', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-only');
    expect((await GET(new NextRequest('https://nucleas.test/api/cron/ai-planning', { headers: { authorization: 'Bearer model-token' } }))).status).toBe(401);
    expect(worker).not.toHaveBeenCalled();
  });
  it('processes authorized invocations and does not cache results', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-only'); worker.mockResolvedValue({ status: 'idle' });
    const response = await GET(new NextRequest('https://nucleas.test/api/cron/ai-planning', { headers: { authorization: 'Bearer cron-only' } }));
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('never leaks worker errors or secrets', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-only'); worker.mockRejectedValue(new Error('secret=must-not-leak'));
    const response = await GET(new NextRequest('https://nucleas.test/api/cron/ai-planning', { headers: { authorization: 'Bearer cron-only' } }));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('must-not-leak');
  });
});
