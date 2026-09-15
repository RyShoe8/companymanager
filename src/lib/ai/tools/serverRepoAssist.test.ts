import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const mocks = vi.hoisted(() => ({
  listTree: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('@/lib/ai/ideCommitPush', () => ({
  listIdeTree: mocks.listTree,
  readIdeFile: mocks.readFile,
}));

import { gatherRepoAssistContext } from '@/lib/ai/tools/serverRepoAssist';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('gatherRepoAssistContext', () => {
  it('returns unbound note when root tree fails', async () => {
    mocks.listTree.mockResolvedValue({ ok: false, reason: 'Bind a GitHub repository.' });
    const result = await gatherRepoAssistContext({
      organizationId: 'org',
      projectId: new Types.ObjectId(),
      userText: 'what does our rules system actually do?',
    });
    expect(result.ok).toBe(false);
    expect(result.contextBlock).toMatch(/bind a GitHub/i);
    expect(result.toolsUsed).toContain('repo_tree');
  });

  it('reads at most two scored rules-related files from parallel seed trees', async () => {
    mocks.listTree.mockImplementation(async (_org: string, _proj: unknown, path = '') => {
      if (path === '') {
        return {
          ok: true,
          branch: 'main',
          entries: [
            { name: 'src', path: 'src', type: 'dir', sha: '1' },
            { name: 'README.md', path: 'README.md', type: 'file', sha: '2' },
          ],
        };
      }
      if (path === 'src/lib/ide') {
        return {
          ok: true,
          branch: 'main',
          entries: [
            { name: 'planModePrompt.ts', path: 'src/lib/ide/planModePrompt.ts', type: 'file', sha: '3' },
            { name: 'loadTaskRules.ts', path: 'src/lib/ide/loadTaskRules.ts', type: 'file', sha: '4' },
            { name: 'ideChatStream.ts', path: 'src/lib/ide/ideChatStream.ts', type: 'file', sha: '5' },
          ],
        };
      }
      return { ok: true, branch: 'main', entries: [] };
    });
    mocks.readFile.mockImplementation(async (_org: string, _proj: unknown, path: string) => ({
      ok: true,
      path,
      branch: 'main',
      content: `// contents of ${path}`,
      sha: 'x',
    }));

    const result = await gatherRepoAssistContext({
      organizationId: 'org',
      projectId: new Types.ObjectId(),
      userText: 'how does our rules system work?',
    });
    expect(result.ok).toBe(true);
    expect(result.toolsUsed).toEqual(expect.arrayContaining(['repo_tree', 'repo_read']));
    expect(result.contextBlock).toMatch(/loadTaskRules|planModePrompt/);
    expect(mocks.readFile).toHaveBeenCalledTimes(2);
    expect(mocks.listTree.mock.calls.length).toBeLessThanOrEqual(4);
  });
});
