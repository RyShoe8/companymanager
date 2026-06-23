import type {
  CatalogCategoryRow,
  CatalogOptionRow,
  PlatformCatalogSnapshot,
  PublicPlatformCatalog,
  StackCatalogSlice,
} from '@/lib/platformCatalog/types';
import type { PlatformStackType } from '@/lib/models/PlatformCategory';

function buildStackSlice(
  stackType: PlatformStackType,
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

export function buildPlatformCatalogSnapshot(
  categories: CatalogCategoryRow[],
  options: CatalogOptionRow[]
): PlatformCatalogSnapshot {
  const tech = buildStackSlice('tech', categories, options);
  const marketing = buildStackSlice('marketing', categories, options);
  const techOptionsById = new Map<string, CatalogOptionRow>();
  const marketingOptionsById = new Map<string, CatalogOptionRow>();
  for (const opt of options) {
    if (opt.stackType === 'tech') techOptionsById.set(opt.optionId, opt);
    else marketingOptionsById.set(opt.optionId, opt);
  }
  return { tech, marketing, techOptionsById, marketingOptionsById };
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
  return {
    tech: filterActive(snapshot.tech),
    marketing: filterActive(snapshot.marketing),
  };
}
