import { NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import PlatformCategory from '@/lib/models/PlatformCategory';
import PlatformOption from '@/lib/models/PlatformOption';
import { requireAdminUser } from '@/lib/blog/requireAdmin';
import { loadPlatformCatalog } from '@/lib/platformCatalog/loadPlatformCatalog';
import { toPublicCatalog } from '@/lib/platformCatalog/buildSnapshot';

export async function GET() {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  await connectDB();
  const snapshot = await loadPlatformCatalog();

  const categories = await PlatformCategory.find().sort({ stackType: 1, displayOrder: 1 }).lean();
  const options = await PlatformOption.find().sort({ stackType: 1, categorySlug: 1, displayOrder: 1 }).lean();

  const optionsByCategory = new Map<string, typeof options>();
  for (const opt of options) {
    const key = `${opt.stackType}:${opt.categorySlug}`;
    const list = optionsByCategory.get(key) ?? [];
    list.push(opt);
    optionsByCategory.set(key, list);
  }

  return NextResponse.json({
    tech: {
      categories: categories
        .filter((c) => c.stackType === 'tech')
        .map((c) => ({
          id: c._id.toString(),
          stackType: c.stackType,
          slug: c.slug,
          label: c.label,
          displayOrder: c.displayOrder,
          isActive: c.isActive,
          options: (optionsByCategory.get(`tech:${c.slug}`) ?? []).map((o) => ({
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
        })),
    },
    marketing: {
      categories: categories
        .filter((c) => c.stackType === 'marketing')
        .map((c) => ({
          id: c._id.toString(),
          stackType: c.stackType,
          slug: c.slug,
          label: c.label,
          displayOrder: c.displayOrder,
          isActive: c.isActive,
          options: (optionsByCategory.get(`marketing:${c.slug}`) ?? []).map((o) => ({
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
        })),
    },
    platformCategorySlugs: [
      ...snapshot.tech.categories.filter((c) => c.isActive).map((c) => c.slug),
      ...snapshot.marketing.categories.filter((c) => c.isActive).map((c) => c.slug),
    ],
    publicCatalog: toPublicCatalog(snapshot),
  });
}
