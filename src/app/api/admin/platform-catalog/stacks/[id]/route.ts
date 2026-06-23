import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import PlatformStack from '@/lib/models/PlatformStack';
import PlatformCategory from '@/lib/models/PlatformCategory';
import PlatformOption from '@/lib/models/PlatformOption';
import { requireAdminUser } from '@/lib/blog/requireAdmin';
import { invalidatePlatformCatalogCache } from '@/lib/platformCatalog/loadPlatformCatalog';
import { isProtectedPlatformStackSlug } from '@/lib/platformCatalog/platformStackConstants';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  await connectDB();
  const stack = await PlatformStack.findById(id);
  if (!stack) return NextResponse.json({ error: 'Stack not found' }, { status: 404 });

  const body = await request.json();
  if (body.label !== undefined) {
    const label = String(body.label).trim();
    if (!label) return NextResponse.json({ error: 'label cannot be empty' }, { status: 400 });
    stack.label = label;
  }
  if (body.isActive !== undefined) stack.isActive = Boolean(body.isActive);
  if (body.displayOrder !== undefined) stack.displayOrder = Number(body.displayOrder);
  if (body.iconFolder !== undefined) {
    const iconFolder = String(body.iconFolder).trim();
    stack.iconFolder = iconFolder || undefined;
  }

  await stack.save();
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
  const stack = await PlatformStack.findById(id);
  if (!stack) return NextResponse.json({ error: 'Stack not found' }, { status: 404 });

  if (isProtectedPlatformStackSlug(stack.slug)) {
    return NextResponse.json({ error: 'Cannot delete built-in stack' }, { status: 400 });
  }

  const deletedOptions = await PlatformOption.deleteMany({ stackType: stack.slug });
  const deletedCategories = await PlatformCategory.deleteMany({ stackType: stack.slug });
  await stack.deleteOne();

  invalidatePlatformCatalogCache();
  return NextResponse.json({
    ok: true,
    deletedOptions: deletedOptions.deletedCount ?? 0,
    deletedCategories: deletedCategories.deletedCount ?? 0,
  });
}
