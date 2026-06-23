import { describe, expect, it } from 'vitest';
import { buildPlatformCatalogSnapshot, toPublicCatalog } from '@/lib/platformCatalog/buildSnapshot';
import { getStaticSeedSnapshot } from '@/lib/platformCatalog/staticSeedSnapshot';
import { sanitizeTechStack, validateTechStackUpdate } from '@/lib/utils/techStack';
import { TECH_STACK_CATALOG, TECH_STACK_CATEGORIES } from '@/lib/techStack/catalog';
import { MARKETING_STACK_CATALOG, MARKETING_STACK_CATEGORIES } from '@/lib/marketingStack/catalog';

describe('platform catalog snapshot', () => {
  it('static seed includes expected category and option counts', () => {
    const snap = getStaticSeedSnapshot();
    expect(snap.tech.categorySlugs).toEqual(TECH_STACK_CATEGORIES);
    expect(snap.marketing.categorySlugs).toEqual(MARKETING_STACK_CATEGORIES);
    expect(snap.techOptionsById.size).toBe(TECH_STACK_CATALOG.length);
    expect(snap.marketingOptionsById.size).toBe(MARKETING_STACK_CATALOG.length);
  });

  it('public catalog filters inactive categories and options', () => {
    const snap = getStaticSeedSnapshot();
    const categories = [
      ...snap.tech.categories.map((c) => ({ ...c, isActive: c.slug !== 'api' })),
      ...snap.marketing.categories,
    ];
    const options = [
      ...snap.tech.options.map((o) => ({ ...o, isActive: o.optionId !== 'vercel' })),
      ...snap.marketing.options,
    ];
    const modified = buildPlatformCatalogSnapshot(categories, options);
    const pub = toPublicCatalog(modified);
    expect(pub.tech.categorySlugs).not.toContain('api');
    expect(pub.tech.options.find((o) => o.optionId === 'vercel')).toBeUndefined();
    expect(pub.tech.options.length).toBeGreaterThan(0);
  });
});

describe('platform catalog validation', () => {
  const snap = getStaticSeedSnapshot();

  it('rejects unknown technology', () => {
    expect(
      validateTechStackUpdate([{ category: 'hosting', technologyId: 'not-real' }], snap)
    ).toMatch(/Unknown technology/);
  });

  it('rejects category mismatch', () => {
    expect(
      validateTechStackUpdate([{ category: 'database', technologyId: 'vercel' }], snap)
    ).toMatch(/Category mismatch/);
  });

  it('keeps inactive option when already linked', () => {
    const inactive = buildPlatformCatalogSnapshot(
      snap.tech.categories.map((c) => ({ ...c })),
      snap.tech.options.map((o) =>
        o.optionId === 'vercel' ? { ...o, isActive: false } : { ...o }
      )
    );
    const stack = [{ category: 'hosting', technologyId: 'vercel' }];
    expect(validateTechStackUpdate(stack, inactive)).toBeNull();
    expect(sanitizeTechStack(stack, inactive)).toEqual(stack);
  });
});
