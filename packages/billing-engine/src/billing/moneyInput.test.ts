import { describe, expect, it } from 'vitest';
import {
  formatCentsAsDollarInput,
  parseDollarInputToCents,
} from './moneyInput';

describe('moneyInput', () => {
  it('formats cents as dollar input', () => {
    expect(formatCentsAsDollarInput(3900)).toBe('39.00');
    expect(formatCentsAsDollarInput(0)).toBe('0.00');
  });

  it('parses dollar strings to cents', () => {
    expect(parseDollarInputToCents('39')).toBe(3900);
    expect(parseDollarInputToCents('39.99')).toBe(3999);
    expect(parseDollarInputToCents('$12.50')).toBe(1250);
    expect(parseDollarInputToCents('')).toBe(0);
  });
});
