import { buildPlatformCatalogSnapshot } from '@/lib/platformCatalog/buildSnapshot';
import type { CatalogCategoryRow, CatalogOptionRow, PlatformCatalogSnapshot } from '@/lib/platformCatalog/types';
import { TECH_STACK_CATALOG, TECH_STACK_CATEGORIES } from '@/lib/techStack/catalog';
import { MARKETING_STACK_CATALOG, MARKETING_STACK_CATEGORIES } from '@/lib/marketingStack/catalog';
import { TECH_STACK_CATEGORY_LABELS } from '@/lib/utils/techStack';
import { MARKETING_STACK_CATEGORY_LABELS } from '@/lib/utils/marketingStack';

let staticSnapshot: PlatformCatalogSnapshot | null = null;

/** In-memory snapshot from hardcoded seed data (tests + sync fallback). */
export function getStaticSeedSnapshot(): PlatformCatalogSnapshot {
  if (staticSnapshot) return staticSnapshot;

  const categories: CatalogCategoryRow[] = [
    ...TECH_STACK_CATEGORIES.map((slug, index) => ({
      id: `tech-${slug}`,
      stackType: 'tech' as const,
      slug,
      label: TECH_STACK_CATEGORY_LABELS[slug] ?? slug,
      displayOrder: index,
      isActive: true,
    })),
    ...MARKETING_STACK_CATEGORIES.map((slug, index) => ({
      id: `marketing-${slug}`,
      stackType: 'marketing' as const,
      slug,
      label: MARKETING_STACK_CATEGORY_LABELS[slug] ?? slug,
      displayOrder: index,
      isActive: true,
    })),
  ];

  const options: CatalogOptionRow[] = [
    ...TECH_STACK_CATALOG.map((entry, index) => ({
      id: `tech-${entry.id}`,
      stackType: 'tech' as const,
      optionId: entry.id,
      categorySlug: entry.category,
      name: entry.name,
      homepageUrl: entry.homepageUrl,
      simpleIconSlug: entry.simpleIconSlug,
      iconExtension: 'svg' as const,
      displayOrder: index,
      isActive: true,
    })),
    ...MARKETING_STACK_CATALOG.map((entry, index) => ({
      id: `marketing-${entry.id}`,
      stackType: 'marketing' as const,
      optionId: entry.id,
      categorySlug: entry.category,
      name: entry.name,
      homepageUrl: entry.homepageUrl,
      simpleIconSlug: entry.simpleIconSlug,
      iconExtension: entry.iconExtension ?? 'svg',
      displayOrder: index,
      isActive: true,
    })),
  ];

  staticSnapshot = buildPlatformCatalogSnapshot(categories, options);
  return staticSnapshot;
}
