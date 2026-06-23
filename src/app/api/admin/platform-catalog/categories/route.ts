import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import PlatformCategory from '@/lib/models/PlatformCategory';
import PlatformOption from '@/lib/models/PlatformOption';
import { requireAdminUser } from '@/lib/blog/requireAdmin';
import { invalidatePlatformCatalogCache } from '@/lib/platformCatalog/loadPlatformCatalog';
import type { PlatformStackType } from '@/lib/models/PlatformCategory';

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  await connectDB();
  const body = await request.json();
  const stackType = body.stackType as PlatformStackType;
  const slug = typeof body.slug === 'string' ? normalizeSlug(body.slug) : '';
  const label = typeof body.label === 'string' ? body.label.trim() : '';

  if (stackType !== 'tech' && stackType !== 'marketing') {
    return NextResponse.json({ error: 'stackType must be tech or marketing' }, { status: 400 });
  }
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  if (!label) return NextResponse.json({ error: 'label is required' }, { status: 400 });

  const existing = await PlatformCategory.findOne({ stackType, slug });
  if (existing) {
    return NextResponse.json({ error: 'Category slug already exists for this stack type' }, { status: 400 });
  }

  const maxOrder = await PlatformCategory.findOne({ stackType }).sort({ displayOrder: -1 }).lean();
  const category = await PlatformCategory.create({
    stackType,
    slug,
    label,
    displayOrder: (maxOrder?.displayOrder ?? -1) + 1,
    isActive: true,
  });

  invalidatePlatformCatalogCache();
  return NextResponse.json({
    id: category._id.toString(),
    stackType: category.stackType,
    slug: category.slug,
    label: category.label,
    displayOrder: category.displayOrder,
    isActive: category.isActive,
    options: [],
  });
}
