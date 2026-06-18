import { describe, expect, it } from 'vitest';
import { isRestartGuideVisible, shouldAutoStart } from '@/lib/platformGuide/eligibility';

describe('platform guide eligibility', () => {
  it('shows restart within 30 days of signup', () => {
    const created = new Date('2026-06-01T12:00:00Z');
    const now = new Date('2026-06-15T12:00:00Z').getTime();
    expect(isRestartGuideVisible(created, now)).toBe(true);
  });

  it('hides restart after 30 days', () => {
    const created = new Date('2026-05-01T12:00:00Z');
    const now = new Date('2026-06-10T12:00:00Z').getTime();
    expect(isRestartGuideVisible(created, now)).toBe(false);
  });

  it('auto-starts when guide not completed', () => {
    expect(shouldAutoStart(null)).toBe(true);
    expect(shouldAutoStart(undefined)).toBe(true);
  });

  it('does not auto-start when guide completed', () => {
    expect(shouldAutoStart('2026-06-01T00:00:00.000Z')).toBe(false);
  });
});
