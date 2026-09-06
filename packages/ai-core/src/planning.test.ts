import { describe, expect, it } from 'vitest';
import { buildPlanningInput, digestValue, parseGeneratedPlan, planningRequest } from './planning';

const objective = { title: 'Fix login', outcome: 'Login works', constraints: 'No deployment', acceptanceCriteria: ['Login test passes'] };
describe('planning context boundary', () => {
  it('only admits explicitly selected objective fields', () => {
    const unexpected = { ...objective, secret: 'do-not-send' };
    expect(() => buildPlanningInput(unexpected)).toThrow();
    const input = buildPlanningInput(objective);
    expect(JSON.parse(input)).toEqual(objective);
    expect(planningRequest(input).messages).toHaveLength(2);
    expect(planningRequest(input)).not.toHaveProperty('tools');
  });
  it('bounds UTF-8 bytes, not just character count', () => {
    expect(() => buildPlanningInput({ ...objective, outcome: '漢'.repeat(3000) })).toThrow();
  });
  it('detects changed input snapshots', () => {
    expect(digestValue(buildPlanningInput(objective))).not.toBe(digestValue(buildPlanningInput({ ...objective, constraints: 'Changed' })));
  });
  it('requires valid JSON and safe task dependencies', () => {
    const valid = { summary: 'Plan', tasks: [{ key: 'a', name: 'Test', acceptanceCriteria: ['Pass'], dependsOn: [] }] };
    expect(parseGeneratedPlan(JSON.stringify(valid)).tasks).toHaveLength(1);
    expect(() => parseGeneratedPlan(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``)).toThrow();
    expect(() => parseGeneratedPlan(JSON.stringify({ ...valid, tasks: [{ ...valid.tasks[0], dependsOn: ['missing'] }] }))).toThrow();
  });
});
