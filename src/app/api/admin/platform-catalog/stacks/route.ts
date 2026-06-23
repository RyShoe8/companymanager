import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import PlatformStack from '@/lib/models/PlatformStack';
import { requireAdminUser } from '@/lib/blog/requireAdmin';
import { invalidatePlatformCatalogCache } from '@/lib/platformCatalog/loadPlatformCatalog';
import { slugifyCatalogName } from '@/lib/platformCatalog/slugify';

export async function GET() {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  await connectDB();
  const stacks = await PlatformStack.find().sort({ displayOrder: 1 }).lean();
  return NextResponse.json(
    stacks.map((s) => ({
      id: s._id.toString(),
      slug: s.slug,
      label: s.label,
      displayOrder: s.displayOrder,
      isActive: s.isActive,
      iconFolder: s.iconFolder,
      linkingMode: s.linkingMode,
    }))
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  await connectDB();
  const body = await request.json();
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  const slugInput = typeof body.slug === 'string' ? body.slug.trim() : '';
  const slug = slugInput ? slugifyCatalogName(slugInput) : slugifyCatalogName(label);

  if (!label) return NextResponse.json({ error: 'label is required' }, { status: 400 });
  if (!slug) return NextResponse.json({ error: 'Could not derive slug from label' }, { status: 400 });

  const existing = await PlatformStack.findOne({ slug });
  if (existing) {
    return NextResponse.json({ error: 'Stack slug already exists' }, { status: 400 });
  }

  const maxOrder = await PlatformStack.findOne().sort({ displayOrder: -1 }).lean();
  const stack = await PlatformStack.create({
    slug,
    label,
    displayOrder: (maxOrder?.displayOrder ?? -1) + 1,
    isActive: true,
    iconFolder: `${slug}-stack`,
    linkingMode: 'catalog',
  });

  invalidatePlatformCatalogCache();
  return NextResponse.json({
    id: stack._id.toString(),
    slug: stack.slug,
    label: stack.label,
    displayOrder: stack.displayOrder,
    isActive: stack.isActive,
    iconFolder: stack.iconFolder,
    linkingMode: stack.linkingMode,
  });
}
