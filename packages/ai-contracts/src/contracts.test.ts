import { describe, expect, it } from 'vitest';
import { executionWorkerRequestSchema, executionWorkerResponseSchema, objectiveInputSchema, planDraftSchema, remoteJobSchema } from './index';

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
  it('bounds execution requests and exact worker results', () => {
    const request = { protocolVersion: 1, requestId: '123e4567-e89b-12d3-a456-426614174000', repository: { owner: 'nucleas', repo: 'app', ref: 'main', accessToken: 'temporary' }, task: 'Implement the approved slice.', model: 'Qwen/Qwen2.5-Coder-14B-Instruct-AWQ' };
    expect(executionWorkerRequestSchema.safeParse(request).success).toBe(true);
    expect(executionWorkerRequestSchema.safeParse({ ...request, shell: 'rm -rf /' }).success).toBe(false);
    expect(executionWorkerResponseSchema.safeParse({ protocolVersion: 1, requestId: request.requestId, status: 'completed', summary: 'Done', baseCommit: 'a'.repeat(40), patch: 'diff', changedFiles: ['a.ts'], evidence: [], limitations: [] }).success).toBe(true);
  });
});
