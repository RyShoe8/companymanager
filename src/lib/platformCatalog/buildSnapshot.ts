import type {
  CatalogCategoryRow,
  CatalogOptionRow,
  CatalogStackRow,
  PlatformCatalogSnapshot,
  PublicPlatformCatalog,
  StackCatalogSlice,
} from '@/lib/platformCatalog/types';
import type { PlatformStackSlug } from '@/lib/models/PlatformCategory';

function buildStackSlice(
  stackType: PlatformStackSlug,
  categories: CatalogCategoryRow[],
  options: CatalogOptionRow[]
): StackCatalogSlice {
  const sortedCategories = [...categories]
    .filter((c) => c.stackType === stackType)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label));
  const categoryLabels: Record<string, string> = {};
  for (const cat of sortedCategories) {
    categoryLabels[cat.slug] = cat.label;
  }
  const sortedOptions = [...options]
    .filter((o) => o.stackType === stackType)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
  return {
    categories: sortedCategories,
    options: sortedOptions,
    categoryLabels,
    categorySlugs: sortedCategories.map((c) => c.slug),
  };
}

function emptySlice(): StackCatalogSlice {
  return { categories: [], options: [], categoryLabels: {}, categorySlugs: [] };
}

export function buildPlatformCatalogSnapshot(
  stacks: CatalogStackRow[],
  categories: CatalogCategoryRow[],
  options: CatalogOptionRow[]
): PlatformCatalogSnapshot {
  const stackSlugs = new Set<string>([
    ...stacks.map((s) => s.slug),
    ...categories.map((c) => c.stackType),
    'tech',
    'marketing',
    'socials',
  ]);

  const slices: Record<string, StackCatalogSlice> = {};
  const optionsByStack: Record<string, Map<string, CatalogOptionRow>> = {};

  for (const slug of stackSlugs) {
    slices[slug] = buildStackSlice(slug, categories, options);
    const map = new Map<string, CatalogOptionRow>();
    for (const opt of options) {
      if (opt.stackType === slug) map.set(opt.optionId, opt);
    }
    optionsByStack[slug] = map;
  }

  return {
    stacks,
    slices,
    optionsByStack,
    tech: slices.tech ?? emptySlice(),
    marketing: slices.marketing ?? emptySlice(),
    techOptionsById: optionsByStack.tech ?? new Map(),
    marketingOptionsById: optionsByStack.marketing ?? new Map(),
  };
}

export function toPublicCatalog(snapshot: PlatformCatalogSnapshot): PublicPlatformCatalog {
  const filterActive = (slice: StackCatalogSlice): StackCatalogSlice => {
    const activeCategorySlugs = new Set(
      slice.categories.filter((c) => c.isActive).map((c) => c.slug)
    );
    return {
      categories: slice.categories.filter((c) => c.isActive),
      options: slice.options.filter(
        (o) => o.isActive && activeCategorySlugs.has(o.categorySlug)
      ),
      categoryLabels: Object.fromEntries(
        Object.entries(slice.categoryLabels).filter(([slug]) => activeCategorySlugs.has(slug))
      ),
      categorySlugs: slice.categorySlugs.filter((slug) => activeCategorySlugs.has(slug)),
    };
  };

  const activeStacks = snapshot.stacks.filter((s) => s.isActive);
  const catalogByStack: Record<string, StackCatalogSlice> = {};
  for (const stack of activeStacks) {
    const slice = snapshot.slices[stack.slug];
    if (slice) catalogByStack[stack.slug] = filterActive(slice);
  }

  return {
    stacks: activeStacks,
    catalogByStack,
    tech: filterActive(snapshot.tech),
    marketing: filterActive(snapshot.marketing),
  };
}

export function getStackSlice(snapshot: PlatformCatalogSnapshot, slug: string): StackCatalogSlice {
  return snapshot.slices[slug] ?? emptySlice();
}

export function getStackOptionsById(
  snapshot: PlatformCatalogSnapshot,
  slug: string
): Map<string, CatalogOptionRow> {
  return snapshot.optionsByStack[slug] ?? new Map();
}
