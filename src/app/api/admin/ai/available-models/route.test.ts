import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), discover: vi.fn() }));
vi.mock('@/lib/auth/requirePlatformAdmin', () => ({ requirePlatformAdmin: mocks.auth }));
vi.mock('@/lib/auth/middleware', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/ai/control/settings', () => ({ readPlatformSettings: mocks.read }));
vi.mock('@/lib/ai/rolePipeline/discoverModels', () => ({ discoverOpenAiCompatibleModels: mocks.discover }));
import { GET } from './route';

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NUCLEAS_AI_REMOTE_BEARER_TOKEN', 'private-token');
  mocks.auth.mockResolvedValue({ error: null });
  mocks.read.mockResolvedValue({ value: { endpoint: 'https://models.example/v1/chat/completions' } });
  mocks.discover.mockResolvedValue({ models: [{ id: 'code/model', label: 'Code', bestAt: 'Coding' }], error: null });
});
afterEach(() => vi.unstubAllEnvs());

it.each([401, 403])('blocks %s before model discovery', async status => {
  mocks.auth.mockResolvedValue({ error: NextResponse.json({}, { status }) });
  expect((await GET()).status).toBe(status);
  expect(mocks.discover).not.toHaveBeenCalled();
});

it('discovers models using the saved endpoint without exposing the credential', async () => {
  const response = await GET();
  expect(response.status).toBe(200);
  expect(mocks.discover).toHaveBeenCalledWith({ endpoint: 'https://models.example/v1/chat/completions', bearerToken: 'private-token' });
  const text = await response.text();
  expect(text).toContain('code/model');
  expect(text).not.toContain('private-token');
});

it('requires the server-side credential', async () => {
  vi.stubEnv('NUCLEAS_AI_REMOTE_BEARER_TOKEN', '');
  expect((await GET()).status).toBe(409);
  expect(mocks.discover).not.toHaveBeenCalled();
});
