import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
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
  const option = await PlatformOption.findById(id);
  if (!option) return NextResponse.json({ error: 'Option not found' }, { status: 404 });

  const body = await request.json();
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
    option.name = name;
  }
  if (body.homepageUrl !== undefined) {
    const homepageUrl = String(body.homepageUrl).trim();
    if (!homepageUrl) return NextResponse.json({ error: 'homepageUrl cannot be empty' }, { status: 400 });
    option.homepageUrl = homepageUrl;
  }
  if (body.simpleIconSlug !== undefined) {
    option.simpleIconSlug = String(body.simpleIconSlug).trim().toLowerCase() || option.optionId;
  }
  if (body.iconExtension !== undefined) {
    option.iconExtension = body.iconExtension === 'png' ? 'png' : 'svg';
  }
  if (body.iconUrl !== undefined) {
    option.iconUrl = body.iconUrl ? String(body.iconUrl).trim() : undefined;
  }
  if (body.isActive !== undefined) option.isActive = Boolean(body.isActive);
  if (body.displayOrder !== undefined) option.displayOrder = Number(body.displayOrder);

  await option.save();
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
  const option = await PlatformOption.findById(id);
  if (!option) return NextResponse.json({ error: 'Option not found' }, { status: 404 });

  option.isActive = false;
  await option.save();
  invalidatePlatformCatalogCache();
  return NextResponse.json({ ok: true });
}
