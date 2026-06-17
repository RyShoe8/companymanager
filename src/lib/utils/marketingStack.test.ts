import { describe, expect, it } from 'vitest';
import { sanitizeMarketingStack, validateMarketingStackUpdate } from '@/lib/utils/marketingStack';

describe('marketingStack utils', () => {
  it('validates a correct marketing stack', () => {
    const stack = [
      { category: 'email', toolId: 'brevo' },
      { category: 'analytics', toolId: 'posthog' },
    ];
    expect(validateMarketingStackUpdate(stack)).toBeNull();
    expect(sanitizeMarketingStack(stack)).toEqual(stack);
  });

  it('rejects unknown toolId', () => {
    expect(
      validateMarketingStackUpdate([{ category: 'email', toolId: 'not-a-real-tool' }])
    ).toMatch(/Unknown tool/);
  });

  it('rejects category mismatch', () => {
    expect(
      validateMarketingStackUpdate([{ category: 'crm', toolId: 'brevo' }])
    ).toMatch(/Category mismatch/);
  });

  it('rejects duplicate toolId', () => {
    expect(
      validateMarketingStackUpdate([
        { category: 'email', toolId: 'brevo' },
        { category: 'email', toolId: 'brevo' },
      ])
    ).toMatch(/Duplicate tool/);
  });

  it('dedupes on sanitize', () => {
    const raw = [
      { category: 'email', toolId: 'brevo' },
      { category: 'email', toolId: 'brevo' },
      { category: 'crm', toolId: 'hubspot' },
    ];
    expect(sanitizeMarketingStack(raw)).toEqual([
      { category: 'email', toolId: 'brevo' },
      { category: 'crm', toolId: 'hubspot' },
    ]);
  });

  it('preserves login and password on sanitize', () => {
    const stack = [
      {
        category: 'analytics',
        toolId: 'posthog',
        login: 'ops@example.com',
        password: 'secret',
      },
    ];
    expect(sanitizeMarketingStack(stack)).toEqual(stack);
  });
});
