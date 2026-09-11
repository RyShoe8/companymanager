import { describe, expect, it } from 'vitest';
import { suggestTeamEmployee } from './teamRouting';
describe('local employee routing suggestions', () => {
  it.each([
    ['Draft a newsletter campaign', 'marketing'], ['Prioritize roadmap requirements', 'product'],
    ['Resolve a customer complaint about a refund', 'support'], ['Refactor the API and add a unit test', 'engineering'],
  ])('suggests a role for %s', (text, role) => { expect(suggestTeamEmployee(text)?.employee).toBe(role); });
  it.each(['', 'Help me with something', 'Campaign and database', 'Decode the capital letters'])('does not guess for ambiguous or unmatched text %s', text => {
    expect(suggestTeamEmployee(text)).toBeNull();
  });
  it('explains matches without returning the entire brief', () => {
    expect(suggestTeamEmployee('Private details: newsletter campaign')).toEqual({ employee: 'marketing', matches: ['campaign', 'newsletter'] });
  });
});
