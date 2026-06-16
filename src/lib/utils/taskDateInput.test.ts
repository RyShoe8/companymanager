import { describe, it, expect } from 'vitest';
import { resolveTaskDateInput, parseOptionalTaskDate } from '@/lib/utils/dateUtils';

describe('resolveTaskDateInput', () => {
  const fallback = new Date('2026-06-01T12:00:00.000Z');

  it('returns null when explicitly cleared', () => {
    expect(resolveTaskDateInput(null)).toBe(null);
    expect(resolveTaskDateInput('')).toBe(null);
  });

  it('uses fallback when value is undefined', () => {
    expect(resolveTaskDateInput(undefined, { fallback })).toEqual(fallback);
  });

  it('parses ISO date strings to UTC midnight', () => {
    const result = resolveTaskDateInput('2026-06-15');
    expect(result).toEqual(new Date(Date.UTC(2026, 5, 15)));
  });

  it('prefers explicit null over fallback', () => {
    expect(resolveTaskDateInput(null, { fallback })).toBe(null);
  });
});

describe('parseOptionalTaskDate', () => {
  it('returns undefined for empty values', () => {
    expect(parseOptionalTaskDate(null)).toBeUndefined();
    expect(parseOptionalTaskDate(undefined)).toBeUndefined();
    expect(parseOptionalTaskDate('')).toBeUndefined();
  });
});
