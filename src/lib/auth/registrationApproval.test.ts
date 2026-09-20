import { describe, expect, it } from 'vitest';
import { effectiveRegistrationApproval, registrationApprovalForSignup } from './registrationApproval';

describe('registration approval', () => {
  it('keeps all legacy accounts approved', () => {
    expect(effectiveRegistrationApproval(undefined)).toBe('approved');
    expect(effectiveRegistrationApproval(null)).toBe('approved');
    expect(effectiveRegistrationApproval('approved')).toBe('approved');
  });
  it('preserves blocked states', () => {
    expect(effectiveRegistrationApproval('pending')).toBe('pending');
    expect(effectiveRegistrationApproval('rejected')).toBe('rejected');
  });
  it('queues public registrations but allows invited teammates', () => {
    expect(registrationApprovalForSignup(false)).toBe('pending');
    expect(registrationApprovalForSignup(true)).toBe('approved');
  });
});

