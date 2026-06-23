import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import PlatformCategory from '@/lib/models/PlatformCategory';
import PlatformOption from '@/lib/models/PlatformOption';
import { requireAdminUser } from '@/lib/blog/requireAdmin';
import { invalidatePlatformCatalogCache } from '@/lib/platformCatalog/loadPlatformCatalog';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  await connectDB();
  const category = await PlatformCategory.findById(id);
  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

  const body = await request.json();
  if (body.label !== undefined) {
    const label = String(body.label).trim();
    if (!label) return NextResponse.json({ error: 'label cannot be empty' }, { status: 400 });
    category.label = label;
  }
  if (body.isActive !== undefined) category.isActive = Boolean(body.isActive);
  if (body.displayOrder !== undefined) category.displayOrder = Number(body.displayOrder);

  await category.save();
  invalidatePlatformCatalogCache();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  await connectDB();
  const category = await PlatformCategory.findById(id);
  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

  const optionCount = await PlatformOption.countDocuments({
    stackType: category.stackType,
    categorySlug: category.slug,
  });
  if (optionCount > 0) {
    return NextResponse.json(
      { error: 'Cannot delete category with options — deactivate instead' },
      { status: 400 }
    );
  }

  await category.deleteOne();
  invalidatePlatformCatalogCache();
  return NextResponse.json({ ok: true });
}
