import { NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import PlatformCategory from '@/lib/models/PlatformCategory';
import PlatformOption from '@/lib/models/PlatformOption';
import PlatformStack from '@/lib/models/PlatformStack';
import { requireAdminUser } from '@/lib/blog/requireAdmin';
import { loadPlatformCatalog } from '@/lib/platformCatalog/loadPlatformCatalog';
import { toPublicCatalog } from '@/lib/platformCatalog/buildSnapshot';

function mapCategoriesWithOptions(
  stackType: string,
  categories: Array<{
    _id: { toString(): string };
    stackType: string;
    slug: string;
    label: string;
    displayOrder: number;
    isActive: boolean;
  }>,
  optionsByCategory: Map<
    string,
    Array<{
      _id: { toString(): string };
      optionId: string;
      categorySlug: string;
      name: string;
      homepageUrl: string;
      simpleIconSlug?: string;
      iconExtension?: string;
      iconUrl?: string;
      displayOrder: number;
      isActive: boolean;
    }>
  >
) {
  return categories
    .filter((c) => c.stackType === stackType)
    .map((c) => ({
      id: c._id.toString(),
      stackType: c.stackType,
      slug: c.slug,
      label: c.label,
      displayOrder: c.displayOrder,
      isActive: c.isActive,
      options: (optionsByCategory.get(`${stackType}:${c.slug}`) ?? []).map((o) => ({
        id: o._id.toString(),
        optionId: o.optionId,
        categorySlug: o.categorySlug,
        name: o.name,
        homepageUrl: o.homepageUrl,
        simpleIconSlug: o.simpleIconSlug,
        iconExtension: o.iconExtension ?? 'svg',
        iconUrl: o.iconUrl,
        displayOrder: o.displayOrder,
        isActive: o.isActive,
      })),
    }));
}

export async function GET() {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  await connectDB();
  const snapshot = await loadPlatformCatalog();

  const [stacks, categories, options] = await Promise.all([
    PlatformStack.find().sort({ displayOrder: 1 }).lean(),
    PlatformCategory.find().sort({ stackType: 1, displayOrder: 1 }).lean(),
    PlatformOption.find().sort({ stackType: 1, categorySlug: 1, displayOrder: 1 }).lean(),
  ]);

  const optionsByCategory = new Map<string, typeof options>();
  for (const opt of options) {
    const key = `${opt.stackType}:${opt.categorySlug}`;
    const list = optionsByCategory.get(key) ?? [];
    list.push(opt);
    optionsByCategory.set(key, list);
  }

  const stackPayload = stacks.map((s) => ({
    id: s._id.toString(),
    slug: s.slug,
    label: s.label,
    displayOrder: s.displayOrder,
    isActive: s.isActive,
    iconFolder: s.iconFolder,
    linkingMode: s.linkingMode,
  }));

  const catalogByStack: Record<string, { categories: ReturnType<typeof mapCategoriesWithOptions> }> = {};
  for (const stack of stacks) {
    catalogByStack[stack.slug] = {
      categories: mapCategoriesWithOptions(stack.slug, categories, optionsByCategory),
    };
  }

  const techCategories = catalogByStack.tech?.categories ?? [];
  const marketingCategories = catalogByStack.marketing?.categories ?? [];

  return NextResponse.json({
    stacks: stackPayload,
    catalogByStack,
    tech: { categories: techCategories },
    marketing: { categories: marketingCategories },
    platformCategorySlugs: [
      ...snapshot.tech.categories.filter((c) => c.isActive).map((c) => c.slug),
      ...snapshot.marketing.categories.filter((c) => c.isActive).map((c) => c.slug),
    ],
    publicCatalog: toPublicCatalog(snapshot),
  });
}
