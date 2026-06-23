import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import PlatformOption from '@/lib/models/PlatformOption';
import { requireAdminUser } from '@/lib/blog/requireAdmin';
import { validateImageFile } from '@/lib/utils/security';
import { invalidatePlatformCatalogCache } from '@/lib/platformCatalog/loadPlatformCatalog';
import { savePlatformIcon } from '@/lib/platformCatalog/savePlatformIcon';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  await connectDB();
  const option = await PlatformOption.findById(id);
  if (!option) return NextResponse.json({ error: 'Option not found' }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size must be less than 2MB' }, { status: 400 });
  }

  const isSvg = file.type === 'image/svg+xml';
  if (!isSvg) {
    const isValidImage = await validateImageFile(file);
    if (!isValidImage) {
      return NextResponse.json({ error: 'Invalid image file' }, { status: 400 });
    }
  }

  const extension: 'svg' | 'png' =
    isSvg || file.name.toLowerCase().endsWith('.svg') ? 'svg' : 'png';
  const bytes = Buffer.from(await file.arrayBuffer());
  const iconUrl = await savePlatformIcon(
    option.stackType,
    option.optionId,
    bytes,
    extension,
    file.type || (extension === 'svg' ? 'image/svg+xml' : 'image/png')
  );

  option.iconUrl = iconUrl;
  option.iconExtension = extension;
  await option.save();
  invalidatePlatformCatalogCache();

  return NextResponse.json({ iconUrl, iconExtension: extension });
}
