import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import PlatformOption from '@/lib/models/PlatformOption';
import { requireAdminUser } from '@/lib/blog/requireAdmin';
import { invalidatePlatformCatalogCache } from '@/lib/platformCatalog/loadPlatformCatalog';
import { fetchColoredSimpleIcon } from '@/lib/platformCatalog/fetchSimpleIcon';
import { savePlatformIcon } from '@/lib/platformCatalog/savePlatformIcon';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  await connectDB();
  const option = await PlatformOption.findById(id);
  if (!option) return NextResponse.json({ error: 'Option not found' }, { status: 404 });

  const slug = option.simpleIconSlug || option.optionId;
  const fetched = await fetchColoredSimpleIcon(slug);
  if (!fetched) {
    return NextResponse.json(
      { error: `Could not fetch icon for slug "${slug}" from Simple Icons` },
      { status: 400 }
    );
  }

  const iconUrl = await savePlatformIcon(
    option.stackType,
    option.optionId,
    Buffer.from(fetched.svg, 'utf-8'),
    'svg',
    'image/svg+xml'
  );

  option.iconUrl = iconUrl;
  option.iconExtension = 'svg';
  await option.save();
  invalidatePlatformCatalogCache();

  return NextResponse.json({ iconUrl, iconExtension: 'svg' });
}
