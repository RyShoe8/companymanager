import { describe, expect, it } from 'vitest';
import { objectiveInputSchema, planDraftSchema, remoteJobSchema } from './index';

const task = (key: string, dependsOn: string[] = []) => ({ key, name: key, acceptanceCriteria: ['Tests pass'], dependsOn });
describe('AI contracts', () => {
  it('requires real acceptance criteria', () => {
    expect(objectiveInputSchema.safeParse({ title: 'Ship', outcome: 'Feature', acceptanceCriteria: [' '] }).success).toBe(false);
  });
  it('accepts a bounded dependency graph', () => {
    expect(planDraftSchema.parse({ summary: 'Plan', tasks: [task('a'), task('b', ['a'])] }).tasks).toHaveLength(2);
  });
  it.each([
    [task('a'), task('a')], [task('a', ['missing'])], [task('a', ['a'])],
    [task('a', ['b']), task('b', ['a'])], [task('a'), task('b', ['a', 'a'])],
    Array.from({ length: 21 }, (_, i) => task(`t${i}`)),
  ])('rejects invalid dependency graphs and expansion', (...tasks) => {
    expect(planDraftSchema.safeParse({ summary: 'Plan', tasks }).success).toBe(false);
  });
  it('rejects model-supplied execution authority and human assignments', () => {
    expect(planDraftSchema.safeParse({ summary: 'Plan', tasks: [{ ...task('a'), assignedToEmployeeIds: ['admin'] }] }).success).toBe(false);
    expect(remoteJobSchema.safeParse({ kind: 'shell', command: 'anything' }).success).toBe(false);
  });
});
