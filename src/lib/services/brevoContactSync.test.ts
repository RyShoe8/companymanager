import { describe, it, expect } from 'vitest';

describe('Brevo contact attribute mapping', () => {
  it('builds ORGANIZATION attribute when organization name is provided', () => {
    const organizationName = 'Acme Corp';
    const attributes: Record<string, string> = {};
    if (organizationName) attributes.ORGANIZATION = organizationName;

    expect(attributes.ORGANIZATION).toBe('Acme Corp');
  });

  it('defaults users list id to 3 when env is unset', () => {
    const raw = (process.env.BREVO_USERS_LIST_ID ?? '3').trim();
    const parsed = Number.parseInt(raw, 10);
    const listId = Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
    expect(listId).toBe(3);
  });
});
