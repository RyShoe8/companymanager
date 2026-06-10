import { describe, expect, it } from 'vitest';
import {
  buildTaskRecurrenceValue,
  isTaskRecurrenceApplyReady,
  validateTaskRecurrenceApply,
} from '@/lib/recurrence/taskRecurrenceInlineLogic';

describe('taskRecurrenceInlineLogic', () => {
  it('does not mark never-end recurrence as apply-ready', () => {
    const value = buildTaskRecurrenceValue({
      preset: 'weekly',
      end: 'never',
      until: '',
      count: '10',
    });
    expect(isTaskRecurrenceApplyReady(value)).toBe(false);
    expect(validateTaskRecurrenceApply(value)).toMatch(/After|On date/);
  });

  it('marks after-count recurrence as apply-ready', () => {
    const value = buildTaskRecurrenceValue({
      preset: 'weekly',
      end: 'after',
      until: '',
      count: '10',
    });
    expect(isTaskRecurrenceApplyReady(value)).toBe(true);
  });

  it('requires end date for on-end recurrence', () => {
    const value = buildTaskRecurrenceValue({
      preset: 'weekly',
      end: 'on',
      until: '',
      count: '10',
    });
    expect(isTaskRecurrenceApplyReady(value)).toBe(false);
    expect(validateTaskRecurrenceApply(value)).toMatch(/End date/);
  });

  it('buildTaskRecurrenceValue is pure (no side effects on re-build)', () => {
    const state = { preset: 'weekly' as const, end: 'after' as const, until: '', count: '5' };
    const first = buildTaskRecurrenceValue(state);
    const second = buildTaskRecurrenceValue(state);
    expect(first).toEqual(second);
    expect(first.preset).toBe('weekly');
    expect(first.count).toBe(5);
  });
});
