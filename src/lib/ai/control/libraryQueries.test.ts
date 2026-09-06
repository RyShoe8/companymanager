import { describe, expect, it, vi } from 'vitest';
vi.mock('./access', () => ({ AiHttpError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
import { decodeLibraryCursor } from './libraryQueries';

describe('objective and plan history cursors', () => {
  const projectId = 'a'.repeat(24);
  const value = { v: 1, kind: 'objectives', projectId, id: 'b'.repeat(24), createdAt: '2026-09-05T00:00:00.000Z' };
  const encode = (input: unknown) => Buffer.from(JSON.stringify(input)).toString('base64url');
  it('binds cursors to both project and collection', () => {
    expect(decodeLibraryCursor(null, 'objectives', projectId)).toBeNull();
    expect(decodeLibraryCursor(encode(value), 'objectives', projectId)).toEqual(value);
    expect(() => decodeLibraryCursor(encode(value), 'plans', projectId)).toThrow();
    expect(() => decodeLibraryCursor(encode(value), 'objectives', 'c'.repeat(24))).toThrow();
  });
  it.each(['', '!', 'a'.repeat(513), encode({ ...value, id: { $ne: null } }), encode({ ...value, createdAt: 'invalid' }), encode({ ...value, kind: 'runs' })])('rejects invalid cursor %s', raw => {
    expect(() => decodeLibraryCursor(raw, 'objectives', projectId)).toThrow();
  });
});
