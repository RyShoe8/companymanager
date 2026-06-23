import { buildPlatformCatalogSnapshot } from '@/lib/platformCatalog/buildSnapshot';
import type { CatalogCategoryRow, CatalogOptionRow, CatalogStackRow, PlatformCatalogSnapshot } from '@/lib/platformCatalog/types';
import { TECH_STACK_CATALOG, TECH_STACK_CATEGORIES } from '@/lib/techStack/catalog';
import { MARKETING_STACK_CATALOG, MARKETING_STACK_CATEGORIES } from '@/lib/marketingStack/catalog';
import { TECH_STACK_CATEGORY_LABELS } from '@/lib/utils/techStack';
import { MARKETING_STACK_CATEGORY_LABELS } from '@/lib/utils/marketingStack';
import { SOCIAL_NETWORK_LABELS } from '@/lib/utils/socialUrls';
import type { SocialNetwork } from '@/lib/models/platformFields';

let staticSnapshot: PlatformCatalogSnapshot | null = null;

const STATIC_STACKS: CatalogStackRow[] = [
  {
    id: 'stack-tech',
    slug: 'tech',
    label: 'Tech stack',
    displayOrder: 0,
    isActive: true,
    iconFolder: 'tech-stack',
    linkingMode: 'catalog',
  },
  {
    id: 'stack-marketing',
    slug: 'marketing',
    label: 'Marketing & Analytics',
    displayOrder: 1,
    isActive: true,
    iconFolder: 'marketing-stack',
    linkingMode: 'catalog',
  },
  {
    id: 'stack-socials',
    slug: 'socials',
    label: 'Socials',
    displayOrder: 2,
    isActive: true,
    linkingMode: 'url',
  },
];

/** In-memory snapshot from hardcoded seed data (tests + sync fallback). */
export function getStaticSeedSnapshot(): PlatformCatalogSnapshot {
  if (staticSnapshot) return staticSnapshot;

  const categories: CatalogCategoryRow[] = [
    ...TECH_STACK_CATEGORIES.map((slug, index) => ({
      id: `tech-${slug}`,
      stackType: 'tech',
      slug,
      label: TECH_STACK_CATEGORY_LABELS[slug] ?? slug,
      displayOrder: index,
      isActive: true,
    })),
    ...MARKETING_STACK_CATEGORIES.map((slug, index) => ({
      id: `marketing-${slug}`,
      stackType: 'marketing',
      slug,
      label: MARKETING_STACK_CATEGORY_LABELS[slug] ?? slug,
      displayOrder: index,
      isActive: true,
    })),
    {
      id: 'socials-networks',
      stackType: 'socials',
      slug: 'networks',
      label: 'Networks',
      displayOrder: 0,
      isActive: true,
    },
  ];

  const socialNetworks = Object.keys(SOCIAL_NETWORK_LABELS) as SocialNetwork[];

  const options: CatalogOptionRow[] = [
    ...TECH_STACK_CATALOG.map((entry, index) => ({
      id: `tech-${entry.id}`,
      stackType: 'tech',
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
      stackType: 'marketing',
      optionId: entry.id,
      categorySlug: entry.category,
      name: entry.name,
      homepageUrl: entry.homepageUrl,
      simpleIconSlug: entry.simpleIconSlug,
      iconExtension: entry.iconExtension ?? 'svg',
      displayOrder: index,
      isActive: true,
    })),
    ...socialNetworks.map((network, index) => ({
      id: `socials-${network}`,
      stackType: 'socials',
      optionId: network,
      categorySlug: 'networks',
      name: SOCIAL_NETWORK_LABELS[network],
      homepageUrl: 'https://example.com',
      iconExtension: 'svg' as const,
      displayOrder: index,
      isActive: true,
    })),
  ];

  staticSnapshot = buildPlatformCatalogSnapshot(STATIC_STACKS, categories, options);
  return staticSnapshot;
}
