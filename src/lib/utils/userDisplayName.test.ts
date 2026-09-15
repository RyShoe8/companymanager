import { describe, expect, it } from 'vitest';
import { userFirstNameFromProfile } from '@/lib/utils/userDisplayName';

describe('userFirstNameFromProfile', () => {
  it('uses the first token of the display name', () => {
    expect(userFirstNameFromProfile('Ryan Shoe', 'ryan@example.com')).toBe('Ryan');
  });

  it('falls back to email local-part then You', () => {
    expect(userFirstNameFromProfile(null, 'ryan@example.com')).toBe('ryan');
    expect(userFirstNameFromProfile(undefined, undefined)).toBe('You');
  });
});
