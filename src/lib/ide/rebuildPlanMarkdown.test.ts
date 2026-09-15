import { describe, expect, it } from 'vitest';
import { rebuildIdePlanMarkdown, withRebuiltPlanMarkdown } from '@/lib/ide/rebuildPlanMarkdown';

describe('rebuildIdePlanMarkdown', () => {
  it('rebuilds markdown from title, summary, and steps', () => {
    expect(
      rebuildIdePlanMarkdown({
        title: 'Ship tree',
        summary: 'Make folders expandable',
        steps: ['Rewrite IdeFileTree', 'Wire IdeShell'],
      })
    ).toBe('# Ship tree\n\nMake folders expandable\n\n1. Rewrite IdeFileTree\n2. Wire IdeShell');
  });

  it('keeps status and refreshes markdown on withRebuiltPlanMarkdown', () => {
    const plan = withRebuiltPlanMarkdown({
      title: 'A',
      summary: 'B',
      steps: ['C'],
      markdown: 'stale',
      status: 'ready_for_review',
    });
    expect(plan.markdown).toContain('# A');
    expect(plan.markdown).toContain('1. C');
    expect(plan.status).toBe('ready_for_review');
  });
});
