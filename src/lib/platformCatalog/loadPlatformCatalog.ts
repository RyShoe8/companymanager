import connectDB from '@/lib/db/mongodb';
import PlatformCategory from '@/lib/models/PlatformCategory';
import PlatformOption from '@/lib/models/PlatformOption';
import { buildPlatformCatalogSnapshot } from '@/lib/platformCatalog/buildSnapshot';
import { seedPlatformCatalogIfEmpty } from '@/lib/platformCatalog/seedPlatformCatalog';
import type { CatalogCategoryRow, CatalogOptionRow, PlatformCatalogSnapshot } from '@/lib/platformCatalog/types';

let cachedSnapshot: PlatformCatalogSnapshot | null = null;

export function invalidatePlatformCatalogCache(): void {
  cachedSnapshot = null;
}

export async function loadPlatformCatalog(): Promise<PlatformCatalogSnapshot> {
  if (cachedSnapshot) return cachedSnapshot;

  await connectDB();
  await seedPlatformCatalogIfEmpty();

  const [categories, options] = await Promise.all([
    PlatformCategory.find().sort({ stackType: 1, displayOrder: 1 }).lean(),
    PlatformOption.find().sort({ stackType: 1, displayOrder: 1 }).lean(),
  ]);

  const categoryRows: CatalogCategoryRow[] = categories.map((c) => ({
    id: c._id.toString(),
    stackType: c.stackType,
    slug: c.slug,
    label: c.label,
    displayOrder: c.displayOrder,
    isActive: c.isActive,
  }));

  const optionRows: CatalogOptionRow[] = options.map((o) => ({
    id: o._id.toString(),
    stackType: o.stackType,
    optionId: o.optionId,
    categorySlug: o.categorySlug,
    name: o.name,
    homepageUrl: o.homepageUrl,
    simpleIconSlug: o.simpleIconSlug,
    iconExtension: o.iconExtension ?? 'svg',
    iconUrl: o.iconUrl,
    displayOrder: o.displayOrder,
    isActive: o.isActive,
  }));

  cachedSnapshot = buildPlatformCatalogSnapshot(categoryRows, optionRows);
  return cachedSnapshot;
}
