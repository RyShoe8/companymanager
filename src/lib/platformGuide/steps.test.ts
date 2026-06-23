import { describe, expect, it } from 'vitest';
import { filterStepsForRole, PLATFORM_GUIDE_STEPS } from '@/lib/platformGuide/steps';

describe('filterStepsForRole', () => {
  it('includes manager project steps for administrators', () => {
    const steps = filterStepsForRole(PLATFORM_GUIDE_STEPS, 'Administrator');
    expect(steps.some((s) => s.id === 'create-project')).toBe(true);
    expect(steps.some((s) => s.id === 'team-invite')).toBe(true);
  });

  it('includes manager project steps for managers', () => {
    const steps = filterStepsForRole(PLATFORM_GUIDE_STEPS, 'Manager');
    expect(steps.some((s) => s.id === 'create-project')).toBe(true);
    expect(steps.some((s) => s.id === 'team-invite')).toBe(false);
  });

  it('excludes admin-only steps for standard users', () => {
    const steps = filterStepsForRole(PLATFORM_GUIDE_STEPS, 'User');
    expect(steps.some((s) => s.id === 'create-project')).toBe(false);
    expect(steps.some((s) => s.id === 'project-form')).toBe(false);
    expect(steps.some((s) => s.id === 'team-invite')).toBe(false);
    expect(steps.some((s) => s.id === 'welcome')).toBe(true);
    expect(steps.some((s) => s.id === 'create-task')).toBe(true);
  });

  it('excludes role-gated steps when role is unknown', () => {
    const steps = filterStepsForRole(PLATFORM_GUIDE_STEPS, undefined);
    expect(steps.some((s) => s.id === 'create-project')).toBe(false);
    expect(steps.length).toBeLessThan(PLATFORM_GUIDE_STEPS.length);
  });

  it('does not include removed command palette or voice steps', () => {
    const ids = PLATFORM_GUIDE_STEPS.map((s) => s.id);
    expect(ids).not.toContain('command-palette');
    expect(ids).not.toContain('voice');
  });

  it('ends with join-community for all roles', () => {
    const lastId = PLATFORM_GUIDE_STEPS[PLATFORM_GUIDE_STEPS.length - 1]?.id;
    expect(lastId).toBe('join-community');

    for (const role of ['User', 'Manager', 'Administrator'] as const) {
      const steps = filterStepsForRole(PLATFORM_GUIDE_STEPS, role);
      expect(steps[steps.length - 1]?.id).toBe('join-community');
      expect(steps.some((s) => s.id === 'join-community')).toBe(true);
    }
  });
});
