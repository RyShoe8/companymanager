import { describe, expect, it } from 'vitest';
import { validatePasswordStrength } from '@/lib/auth/passwordPolicy';

describe('validatePasswordStrength', () => {
  it('rejects passwords that are too short', () => {
    expect(validatePasswordStrength('Ab1!')).toMatch(/between 8 and 128/);
  });

  it('rejects passwords without a digit', () => {
    expect(validatePasswordStrength('longpassword!')).toMatch(/one number/);
  });

  it('rejects passwords without a special character', () => {
    expect(validatePasswordStrength('NoSymbol1')).toMatch(/special character/);
  });

  it('accepts valid passwords', () => {
    expect(validatePasswordStrength('MyPass1!')).toBeNull();
    expect(validatePasswordStrength('secure9._')).toBeNull();
  });
});
