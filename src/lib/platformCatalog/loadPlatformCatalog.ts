import connectDB from '@/lib/db/mongodb';
import PlatformCategory from '@/lib/models/PlatformCategory';
import PlatformOption from '@/lib/models/PlatformOption';
import PlatformStack from '@/lib/models/PlatformStack';
import { buildPlatformCatalogSnapshot } from '@/lib/platformCatalog/buildSnapshot';
import { seedPlatformCatalogIfEmpty } from '@/lib/platformCatalog/seedPlatformCatalog';
import {
  ensureBuiltinPlatformStacks,
  seedPlatformStacksIfEmpty,
  seedSocialsCatalogIfMissing,
} from '@/lib/platformCatalog/seedPlatformStacks';
import type { CatalogCategoryRow, CatalogOptionRow, CatalogStackRow, PlatformCatalogSnapshot } from '@/lib/platformCatalog/types';

let cachedSnapshot: PlatformCatalogSnapshot | null = null;

export function invalidatePlatformCatalogCache(): void {
  cachedSnapshot = null;
}

export async function loadPlatformCatalog(): Promise<PlatformCatalogSnapshot> {
  if (cachedSnapshot) return cachedSnapshot;

  await connectDB();
  await seedPlatformStacksIfEmpty();
  await ensureBuiltinPlatformStacks();
  await seedPlatformCatalogIfEmpty();
  await seedSocialsCatalogIfMissing();

  const [stacks, categories, options] = await Promise.all([
    PlatformStack.find().sort({ displayOrder: 1 }).lean(),
    PlatformCategory.find().sort({ stackType: 1, displayOrder: 1 }).lean(),
    PlatformOption.find().sort({ stackType: 1, displayOrder: 1 }).lean(),
  ]);

  const stackRows: CatalogStackRow[] = stacks.map((s) => ({
    id: s._id.toString(),
    slug: s.slug,
    label: s.label,
    displayOrder: s.displayOrder,
    isActive: s.isActive,
    iconFolder: s.iconFolder,
    linkingMode: s.linkingMode,
  }));

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

  cachedSnapshot = buildPlatformCatalogSnapshot(stackRows, categoryRows, optionRows);
  return cachedSnapshot;
}
