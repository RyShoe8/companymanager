import { describe, expect, it } from 'vitest';
import {
  aiEmployees,
  normalizeTeamRole,
  teamHistoryFilter,
  teamHistorySchema,
  teamRequestSchema,
} from './teamWorkspace';

const input = {
  requestId: 'ba10a6a6-e385-4f18-a68c-17f7b1a6e35e',
  employee: 'product',
  kind: 'task',
  text: '  Prepare a brief  ',
  cadence: 'weekly',
};

describe('AI team intake contract', () => {
  it('normalizes text and preserves explicitly selected role and recurrence', () => {
    expect(teamRequestSchema.parse(input)).toMatchObject({
      text: 'Prepare a brief',
      employee: 'product',
      cadence: 'weekly',
    });
  });
  it('contains stable role presets distinct from human employee IDs', () => {
    expect(aiEmployees.map((role) => role.id)).toEqual([
      'marketing',
      'product',
      'support',
      'engineering',
      'researcher',
    ]);
  });
  it.each([
    { text: '' },
    { text: 'x'.repeat(6001) },
    { employee: 'administrator' },
    { kind: 'message' },
    { cadence: 'hourly' },
    { requestId: 'invalid' },
    { execute: true },
  ])('rejects invalid or expanded requests %o', (patch) => {
    expect(teamRequestSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  });
});

describe('AI team history filters', () => {
  it('defaults to an unfiltered private history', () => {
    expect(teamHistoryFilter(teamHistorySchema.parse({}))).toEqual({});
  });
  it('builds only allowed database predicates', () => {
    expect(
      teamHistoryFilter(
        teamHistorySchema.parse({
          employee: 'support',
          kind: 'task',
          status: 'saved',
          recurring: 'true',
        })
      )
    ).toEqual({
      employee: 'support',
      kind: 'task',
      status: 'saved',
      cadence: { $in: ['daily', 'weekly'] },
    });
  });
  it.each([
    { employee: 'admin' },
    { status: 'running' },
    { recurring: 'false' },
    { cursor: 'bad' },
    { createdByUserId: 'someone' },
    { organizationId: 'other' },
  ])('rejects unsupported query %o', (query) => {
    expect(teamHistorySchema.safeParse(query).success).toBe(false);
  });
});

describe('normalizeTeamRole', () => {
  it('defaults legacy rows to user', () => {
    expect(normalizeTeamRole(undefined)).toBe('user');
    expect(normalizeTeamRole('assistant')).toBe('assistant');
    expect(normalizeTeamRole('status')).toBe('status');
  });
});
