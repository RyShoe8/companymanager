import { describe, expect, it } from 'vitest';
import { ideRepoPathSchema } from '@/lib/ai/idePublishSchema';

describe('ideRepoPathSchema', () => {
  it('accepts Next.js App Router dynamic segments', () => {
    const path = 'src/app/api/projects/[id]/ai/ide/chat/route.ts';
    expect(ideRepoPathSchema.parse(path)).toBe(path);
  });

  it('accepts normal source paths', () => {
    expect(ideRepoPathSchema.parse('src/lib/ai/ideDirectChat.ts')).toBe(
      'src/lib/ai/ideDirectChat.ts'
    );
  });

  it('rejects traversal and absolute paths', () => {
    expect(ideRepoPathSchema.safeParse('../secret').success).toBe(false);
    expect(ideRepoPathSchema.safeParse('/etc/passwd').success).toBe(false);
    expect(ideRepoPathSchema.safeParse('foo/../../bar').success).toBe(false);
  });
});
