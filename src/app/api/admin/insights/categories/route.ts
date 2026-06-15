import { NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import InsightCategory from '@/lib/models/InsightCategory';
import InsightItem from '@/lib/models/InsightItem';
import InsightVendor from '@/lib/models/InsightVendor';
import { requireAdminInsights } from '@/lib/insights/requireAdminInsights';
import { seedInsightCategoriesIfEmpty } from '@/lib/insights/seedInsightCategories';

export async function GET() {
  const auth = await requireAdminInsights();
  if (auth.error) return auth.error;

  await connectDB();
  await seedInsightCategoriesIfEmpty();

  const categories = await InsightCategory.find().sort({ stageOrder: 1 }).lean();
  const items = await InsightItem.find().sort({ itemOrder: 1 }).lean();
  const vendors = await InsightVendor.find().sort({ displayOrder: 1 }).lean();

  const vendorCountByItem = new Map<string, number>();
  for (const v of vendors) {
    const key = v.itemId.toString();
    vendorCountByItem.set(key, (vendorCountByItem.get(key) ?? 0) + 1);
  }

  const itemsByCategory = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.categoryId.toString();
    const list = itemsByCategory.get(key) ?? [];
    list.push(item);
    itemsByCategory.set(key, list);
  }

  const vendorsByItem = new Map<string, typeof vendors>();
  for (const v of vendors) {
    const key = v.itemId.toString();
    const list = vendorsByItem.get(key) ?? [];
    list.push(v);
    vendorsByItem.set(key, list);
  }

  return NextResponse.json({
    categories: categories.map((cat) => ({
      id: cat._id.toString(),
      name: cat.name,
      slug: cat.slug,
      stageOrder: cat.stageOrder,
      icon: cat.icon,
      mapsToPlatformCategory: cat.mapsToPlatformCategory,
      items: (itemsByCategory.get(cat._id.toString()) ?? []).map((item) => ({
        id: item._id.toString(),
        categoryId: item.categoryId.toString(),
        title: item.title,
        description: item.description,
        itemOrder: item.itemOrder,
        detectsFromCategorySlug: item.detectsFromCategorySlug,
        isActive: item.isActive,
        vendorCount: vendorCountByItem.get(item._id.toString()) ?? 0,
        vendors: (vendorsByItem.get(item._id.toString()) ?? []).map((v) => ({
          id: v._id.toString(),
          itemId: v.itemId.toString(),
          name: v.name,
          description: v.description,
          pricing: v.pricing,
          url: v.url,
          vendorSlug: v.vendorSlug,
          isAffiliate: v.isAffiliate,
          displayOrder: v.displayOrder,
          isActive: v.isActive,
        })),
      })),
    })),
    platformCategorySlugs: [
      'hosting',
      'database',
      'api',
      'framework',
      'payments',
      'email',
      'analytics',
      'social',
      'crm',
    ],
  });
}
