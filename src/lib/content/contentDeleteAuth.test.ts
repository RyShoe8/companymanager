import { describe, expect, it } from 'vitest';
import { canAccessContentItem, canDeleteContentItem } from '@/lib/content/contentDeleteAuth';

const item = {
  userId: 'user-1',
  assignedToEmployeeId: 'emp-2',
};

describe('canAccessContentItem', () => {
  it('allows managers and administrators', () => {
    expect(
      canAccessContentItem({
        isManagerOrAdmin: true,
        currentUserId: 'other',
        currentUserEmployeeId: 'other',
        item,
      })
    ).toBe(true);
  });

  it('allows creators and assignees', () => {
    expect(
      canAccessContentItem({
        isManagerOrAdmin: false,
        currentUserId: 'user-1',
        currentUserEmployeeId: 'emp-9',
        item,
      })
    ).toBe(true);
    expect(
      canAccessContentItem({
        isManagerOrAdmin: false,
        currentUserId: 'user-9',
        currentUserEmployeeId: 'emp-2',
        item,
      })
    ).toBe(true);
  });

  it('denies unrelated contributors', () => {
    expect(
      canAccessContentItem({
        isManagerOrAdmin: false,
        currentUserId: 'user-9',
        currentUserEmployeeId: 'emp-9',
        item,
      })
    ).toBe(false);
  });
});

describe('canDeleteContentItem', () => {
  it('mirrors access rules', () => {
    expect(
      canDeleteContentItem({
        isManagerOrAdmin: false,
        currentUserId: 'user-1',
        currentUserEmployeeId: null,
        item,
      })
    ).toBe(true);
  });
});
