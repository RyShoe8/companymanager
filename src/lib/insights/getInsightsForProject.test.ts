import { describe, it, expect } from 'vitest';
import { getProjectLinkedCategorySlugs, diffNewLinkedCategorySlugs } from '@/lib/insights/getProjectLinkedCategorySlugs';

describe('getProjectLinkedCategorySlugs', () => {
  it('collects tech and marketing stack categories', () => {
    const slugs = getProjectLinkedCategorySlugs({
      techStack: [{ category: 'hosting', technologyId: 'vercel' }],
      marketingStack: [{ category: 'email', toolId: 'brevo' }],
    });
    expect(slugs.has('hosting')).toBe(true);
    expect(slugs.has('email')).toBe(true);
    expect(slugs.size).toBe(2);
  });

  it('diffNewLinkedCategorySlugs returns only newly added slugs', () => {
    const before = { techStack: [{ category: 'hosting', technologyId: 'vercel' }], marketingStack: [] };
    const after = {
      techStack: [
        { category: 'hosting', technologyId: 'vercel' },
        { category: 'payments', technologyId: 'stripe' },
      ],
      marketingStack: [{ category: 'analytics', toolId: 'posthog' }],
    };
    const added = diffNewLinkedCategorySlugs(before, after);
    expect(added.sort()).toEqual(['analytics', 'payments']);
  });
});

describe('insight exclusion logic', () => {
  function isExcluded(
    detectsFrom: string | undefined,
    state: 'completed' | 'dismissed' | undefined,
    linked: Set<string>
  ): boolean {
    if (state === 'completed' || state === 'dismissed') return true;
    if (detectsFrom && linked.has(detectsFrom)) return true;
    return false;
  }

  it('auto-completes when linked platform category matches', () => {
    expect(isExcluded('hosting', undefined, new Set(['hosting']))).toBe(true);
  });

  it('does not exclude pending items without state or link', () => {
    expect(isExcluded(undefined, undefined, new Set())).toBe(false);
  });

  it('excludes dismissed items', () => {
    expect(isExcluded(undefined, 'dismissed', new Set())).toBe(true);
  });
});
