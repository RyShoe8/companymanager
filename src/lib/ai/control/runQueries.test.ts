import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/ai/control/access', () => ({ AiHttpError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
import { decodeRunCursor, parseEventAfter } from './runQueries';
import { runFailureGuidance } from '@/lib/ai/runView';

describe('bounded run history cursors', () => {
  const projectId = 'a'.repeat(24);
  const cursor = { v: 1, projectId, id: 'b'.repeat(24), createdAt: '2026-09-05T00:00:00.000Z' };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  it('accepts a valid cursor only for its project', () => {
    expect(decodeRunCursor(null, projectId)).toBeNull();
    expect(decodeRunCursor(encode(cursor), projectId)).toEqual(cursor);
    expect(() => decodeRunCursor(encode(cursor), 'c'.repeat(24))).toThrow();
  });
  it.each(['', '!', 'a'.repeat(513), encode({ ...cursor, id: { $ne: null } }), encode({ ...cursor, createdAt: 'bad' }), encode({ ...cursor, v: 2 })])('rejects invalid cursor %s', value => {
    expect(() => decodeRunCursor(value, projectId)).toThrow();
  });
  it('requires bounded integer event cursors', () => {
    expect(parseEventAfter(null)).toBe(-1); expect(parseEventAfter('0')).toBe(0); expect(parseEventAfter('50')).toBe(50);
    for (const value of ['-1', '1.5', 'Infinity', '1e3', '9007199254740992', '', '{"$gt":0}']) expect(() => parseEventAfter(value)).toThrow();
  });
  it('uses static guidance rather than reflecting unknown provider messages', () => {
    expect(runFailureGuidance(null)).toBeNull();
    expect(runFailureGuidance('credentials')).toContain('bearer token');
    expect(runFailureGuidance('secret-provider-error')).not.toContain('secret-provider-error');
    expect(runFailureGuidance('cancelled')).toContain('not proof');
  });
});
