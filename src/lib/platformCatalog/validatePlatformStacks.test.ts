import { describe, expect, it } from 'vitest';
import {
  sanitizePlatformStacks,
  validatePlatformStacksUpdate,
} from '@/lib/platformCatalog/validatePlatformStacks';
import { buildPlatformCatalogSnapshot } from '@/lib/platformCatalog/buildSnapshot';
import type { CatalogCategoryRow, CatalogOptionRow, CatalogStackRow } from '@/lib/platformCatalog/types';
import { getStaticSeedSnapshot } from '@/lib/platformCatalog/staticSeedSnapshot';

const customStack: CatalogStackRow = {
  id: 'stack-design',
  slug: 'design',
  label: 'Design tools',
  displayOrder: 10,
  isActive: true,
  iconFolder: 'design-stack',
  linkingMode: 'catalog',
};

const customCategory: CatalogCategoryRow = {
  id: 'design-ui',
  stackType: 'design',
  slug: 'ui',
  label: 'UI',
  displayOrder: 0,
  isActive: true,
};

const customOption: CatalogOptionRow = {
  id: 'design-figma',
  stackType: 'design',
  optionId: 'figma',
  categorySlug: 'ui',
  name: 'Figma',
  homepageUrl: 'https://figma.com',
  iconExtension: 'svg',
  displayOrder: 0,
  isActive: true,
};

function catalogWithCustomStack() {
  const base = getStaticSeedSnapshot();
  return buildPlatformCatalogSnapshot(
    [...base.stacks, customStack],
    [...base.tech.categories, ...base.marketing.categories, customCategory],
    [...base.tech.options, ...base.marketing.options, customOption]
  );
}

describe('validatePlatformStacks', () => {
  it('rejects built-in stack keys', () => {
    const snap = catalogWithCustomStack();
    expect(validatePlatformStacksUpdate({ tech: [] }, snap)).toMatch(/built-in stack/);
  });

  it('accepts valid custom stack items', () => {
    const snap = catalogWithCustomStack();
    const payload = { design: [{ category: 'ui', optionId: 'figma' }] };
    expect(validatePlatformStacksUpdate(payload, snap)).toBeNull();
    expect(sanitizePlatformStacks(payload, snap)).toEqual(payload);
  });

  it('rejects unknown stack slug', () => {
    const snap = catalogWithCustomStack();
    expect(validatePlatformStacksUpdate({ unknown: [] }, snap)).toMatch(/Unknown or inactive/);
  });
});
