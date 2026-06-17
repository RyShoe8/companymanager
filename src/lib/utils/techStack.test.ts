import { describe, expect, it } from 'vitest';
import { sanitizeTechStack, validateTechStackUpdate } from '@/lib/utils/techStack';

describe('techStack utils', () => {
  it('validates a correct tech stack', () => {
    const stack = [
      { category: 'hosting', technologyId: 'vercel' },
      { category: 'framework', technologyId: 'nextjs' },
    ];
    expect(validateTechStackUpdate(stack)).toBeNull();
    expect(sanitizeTechStack(stack)).toEqual(stack);
  });

  it('rejects unknown technologyId', () => {
    expect(
      validateTechStackUpdate([{ category: 'hosting', technologyId: 'not-a-real-tech' }])
    ).toMatch(/Unknown technology/);
  });

  it('rejects category mismatch', () => {
    expect(
      validateTechStackUpdate([{ category: 'database', technologyId: 'vercel' }])
    ).toMatch(/Category mismatch/);
  });

  it('rejects duplicate technologyId', () => {
    expect(
      validateTechStackUpdate([
        { category: 'hosting', technologyId: 'vercel' },
        { category: 'hosting', technologyId: 'vercel' },
      ])
    ).toMatch(/Duplicate technology/);
  });

  it('dedupes on sanitize', () => {
    const raw = [
      { category: 'hosting', technologyId: 'vercel' },
      { category: 'hosting', technologyId: 'vercel' },
      { category: 'framework', technologyId: 'react' },
    ];
    expect(sanitizeTechStack(raw)).toEqual([
      { category: 'hosting', technologyId: 'vercel' },
      { category: 'framework', technologyId: 'react' },
    ]);
  });

  it('preserves login and password on sanitize', () => {
    const stack = [
      {
        category: 'hosting',
        technologyId: 'vercel',
        login: 'admin@example.com',
        password: 'secret',
      },
    ];
    expect(sanitizeTechStack(stack)).toEqual(stack);
  });
});
