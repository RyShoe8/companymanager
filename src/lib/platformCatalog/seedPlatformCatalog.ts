import PlatformCategory from '@/lib/models/PlatformCategory';
import PlatformOption from '@/lib/models/PlatformOption';
import { TECH_STACK_CATALOG, TECH_STACK_CATEGORIES } from '@/lib/techStack/catalog';
import { MARKETING_STACK_CATALOG, MARKETING_STACK_CATEGORIES } from '@/lib/marketingStack/catalog';
import { TECH_STACK_CATEGORY_LABELS } from '@/lib/utils/techStack';
import { MARKETING_STACK_CATEGORY_LABELS } from '@/lib/utils/marketingStack';

export async function seedPlatformCatalogIfEmpty(): Promise<void> {
  const categoryCount = await PlatformCategory.countDocuments();
  if (categoryCount > 0) return;

  const techCategories = TECH_STACK_CATEGORIES.map((slug, index) => ({
    stackType: 'tech' as const,
    slug,
    label: TECH_STACK_CATEGORY_LABELS[slug],
    displayOrder: index,
    isActive: true,
  }));
  const marketingCategories = MARKETING_STACK_CATEGORIES.map((slug, index) => ({
    stackType: 'marketing' as const,
    slug,
    label: MARKETING_STACK_CATEGORY_LABELS[slug],
    displayOrder: index,
    isActive: true,
  }));

  await PlatformCategory.insertMany([...techCategories, ...marketingCategories]);

  const techOptions = TECH_STACK_CATALOG.map((entry, index) => ({
    stackType: 'tech' as const,
    optionId: entry.id,
    categorySlug: entry.category,
    name: entry.name,
    homepageUrl: entry.homepageUrl,
    simpleIconSlug: entry.simpleIconSlug,
    iconExtension: 'svg' as const,
    displayOrder: index,
    isActive: true,
  }));

  const marketingOptions = MARKETING_STACK_CATALOG.map((entry, index) => ({
    stackType: 'marketing' as const,
    optionId: entry.id,
    categorySlug: entry.category,
    name: entry.name,
    homepageUrl: entry.homepageUrl,
    simpleIconSlug: entry.simpleIconSlug,
    iconExtension: entry.iconExtension ?? 'svg',
    displayOrder: index,
    isActive: true,
  }));

  await PlatformOption.insertMany([...techOptions, ...marketingOptions]);
}
