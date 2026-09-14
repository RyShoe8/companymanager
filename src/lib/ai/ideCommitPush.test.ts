import { describe, expect, it } from 'vitest';
import { ideCommitPushSchema } from '@/lib/ai/idePublishSchema';

describe('ideCommitPushSchema', () => {
  it('requires explicit confirm', () => {
    expect(() =>
      ideCommitPushSchema.parse({
        confirm: false,
        message: 'x',
        files: [{ path: 'a.ts', content: '1' }],
      })
    ).toThrow();
  });

  it('accepts a confirmed single-file push payload', () => {
    const parsed = ideCommitPushSchema.parse({
      confirm: true,
      message: 'Fix typo',
      files: [{ path: 'README.md', content: '# Hi' }],
    });
    expect(parsed.confirm).toBe(true);
    expect(parsed.files).toHaveLength(1);
  });
});
