import { describe, expect, it } from 'vitest';
import { isActiveWorkspaceContent, isActiveWorkspaceTask } from '@/lib/workspace/activeWorkspaceItems';

describe('activeWorkspaceItems', () => {
  it('treats completed tasks as inactive', () => {
    expect(isActiveWorkspaceTask({ status: 'in_progress' } as never)).toBe(true);
    expect(isActiveWorkspaceTask({ status: 'completed' } as never)).toBe(false);
  });

  it('treats published content as inactive', () => {
    expect(isActiveWorkspaceContent({ status: 'planned' } as never)).toBe(true);
    expect(isActiveWorkspaceContent({ status: 'published' } as never)).toBe(false);
  });
});
