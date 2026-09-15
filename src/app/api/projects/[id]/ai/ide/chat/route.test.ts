import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  history: vi.fn(),
  append: vi.fn(),
  team: vi.fn(),
  direct: vi.fn(),
  rules: vi.fn(),
}));

vi.mock('@/lib/auth/middleware', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/ai/control/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai/control/access')>()),
  requireAiProject: mocks.access,
}));
vi.mock('@/lib/ide/chatHistory', () => ({
  loadIdeChatHistory: mocks.history,
  appendIdeChatTurns: mocks.append,
}));
vi.mock('@/lib/ai/teamChat', () => ({ attemptTeamChatReply: mocks.team }));
vi.mock('@/lib/ai/ideDirectChat', () => ({ attemptDirectModelChat: mocks.direct }));
vi.mock('@/lib/ide/loadTaskRules', () => ({ loadIdeTaskRuleTexts: mocks.rules }));

import { AiHttpError } from '@/lib/ai/control/access';
import { GET } from '@/app/api/projects/[id]/ai/ide/chat/route';

const projectId = 'a'.repeat(24);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue({
    organizationId: 'org',
    userId: 'u'.repeat(24),
    project: { _id: new Types.ObjectId(projectId), name: 'Demo' },
  });
  mocks.history.mockResolvedValue([{ requestId: 't1', role: 'user', text: 'hi' }]);
  mocks.rules.mockResolvedValue([]);
});

describe('GET /api/projects/[id]/ai/ide/chat', () => {
  it('fails closed when project access is denied', async () => {
    mocks.access.mockRejectedValue(new AiHttpError(404, 'Unavailable.'));
    const request = new NextRequest(
      `https://nucleas.test/api/projects/${projectId}/ai/ide/chat?mode=product`
    );
    const response = await GET(request, { params: Promise.resolve({ id: projectId }) });
    expect(response.status).toBe(404);
    expect(mocks.history).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid mode without a generic 503', async () => {
    const request = new NextRequest(
      `https://nucleas.test/api/projects/${projectId}/ai/ide/chat?mode=not-a-mode`
    );
    const response = await GET(request, { params: Promise.resolve({ id: projectId }) });
    expect(response.status).toBe(400);
    expect(mocks.history).not.toHaveBeenCalled();
  });

  it('loads history scoped by mode and Direct selection', async () => {
    const request = new NextRequest(
      `https://nucleas.test/api/projects/${projectId}/ai/ide/chat?mode=direct&modelProfileId=prof&model=local%2Fm`
    );
    const response = await GET(request, { params: Promise.resolve({ id: projectId }) });
    expect(response.status).toBe(200);
    expect(mocks.history).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org',
        mode: 'direct',
        modelProfileId: 'prof',
        model: 'local/m',
      })
    );
    await expect(response.json()).resolves.toMatchObject({
      mode: 'direct',
      turns: [{ requestId: 't1', role: 'user', text: 'hi' }],
    });
  });

  it('returns empty turns when history soft-fails', async () => {
    mocks.history.mockResolvedValue([]);
    const request = new NextRequest(
      `https://nucleas.test/api/projects/${projectId}/ai/ide/chat?mode=product`
    );
    const response = await GET(request, { params: Promise.resolve({ id: projectId }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ mode: 'product', turns: [] });
  });
});
