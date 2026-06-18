import { describe, expect, it } from 'vitest';
import { AccountDeletionError } from '@/lib/account/accountDeletionError';

describe('AccountDeletionError', () => {
  it('carries status code for API responses', () => {
    const err = new AccountDeletionError('Remove team members first.', 409);
    expect(err.message).toBe('Remove team members first.');
    expect(err.statusCode).toBe(409);
    expect(err.name).toBe('AccountDeletionError');
  });
});
