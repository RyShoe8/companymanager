import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import PlatformCategory from '@/lib/models/PlatformCategory';
import PlatformOption from '@/lib/models/PlatformOption';
import { requireAdminUser } from '@/lib/blog/requireAdmin';
import { invalidatePlatformCatalogCache } from '@/lib/platformCatalog/loadPlatformCatalog';
import type { PlatformStackType } from '@/lib/models/PlatformCategory';

function normalizeOptionId(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  await connectDB();
  const body = await request.json();
  const stackType = body.stackType as PlatformStackType;
  const categorySlug = typeof body.categorySlug === 'string' ? body.categorySlug.trim().toLowerCase() : '';
  const optionId = typeof body.optionId === 'string' ? normalizeOptionId(body.optionId) : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const homepageUrl = typeof body.homepageUrl === 'string' ? body.homepageUrl.trim() : '';
  const simpleIconSlug =
    typeof body.simpleIconSlug === 'string' && body.simpleIconSlug.trim()
      ? body.simpleIconSlug.trim().toLowerCase()
      : optionId;
  const iconExtension = body.iconExtension === 'png' ? 'png' : 'svg';

  if (stackType !== 'tech' && stackType !== 'marketing') {
    return NextResponse.json({ error: 'stackType must be tech or marketing' }, { status: 400 });
  }
  if (!categorySlug) return NextResponse.json({ error: 'categorySlug is required' }, { status: 400 });
  if (!optionId) return NextResponse.json({ error: 'optionId is required' }, { status: 400 });
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!homepageUrl) return NextResponse.json({ error: 'homepageUrl is required' }, { status: 400 });

  const category = await PlatformCategory.findOne({ stackType, slug: categorySlug });
  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 400 });
  }

  const existing = await PlatformOption.findOne({ stackType, optionId });
  if (existing) {
    return NextResponse.json({ error: 'optionId already exists for this stack type' }, { status: 400 });
  }

  const maxOrder = await PlatformOption.findOne({ stackType, categorySlug })
    .sort({ displayOrder: -1 })
    .lean();

  const option = await PlatformOption.create({
    stackType,
    optionId,
    categorySlug,
    name,
    homepageUrl,
    simpleIconSlug,
    iconExtension,
    displayOrder: (maxOrder?.displayOrder ?? -1) + 1,
    isActive: true,
  });

  invalidatePlatformCatalogCache();
  return NextResponse.json({
    id: option._id.toString(),
    optionId: option.optionId,
    categorySlug: option.categorySlug,
    name: option.name,
    homepageUrl: option.homepageUrl,
    simpleIconSlug: option.simpleIconSlug,
    iconExtension: option.iconExtension,
    iconUrl: option.iconUrl,
    displayOrder: option.displayOrder,
    isActive: option.isActive,
  });
}
