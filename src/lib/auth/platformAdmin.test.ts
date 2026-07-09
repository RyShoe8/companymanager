import { describe, expect, it } from 'vitest';
import { isPlatformAdmin } from '@/lib/auth/platformAdmin';

describe('isPlatformAdmin', () => {
  it('returns true when isAdmin flag is set', () => {
    expect(isPlatformAdmin({ isAdmin: true, email: 'user@example.com' })).toBe(true);
  });

  it('returns true for allowlisted admin emails without db flag', () => {
    expect(
      isPlatformAdmin({ isAdmin: false, email: 'ryanschumacher@themediashop.co' })
    ).toBe(true);
  });

  it('returns false for regular users', () => {
    expect(isPlatformAdmin({ isAdmin: false, email: 'user@example.com' })).toBe(false);
  });
});
