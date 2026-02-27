import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { validateImageFile } from '@/lib/utils/security';

/**
 * POST /api/admin/referral-catalog/upload
 * Upload an icon/image for a Stage Management (button category) entry. Manager/Admin only.
 * Returns { url } for use as entry.imageUrl.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const Employee = (await import('@/lib/models/Employee')).default;
    const employee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    if (!employee || (employee.role !== 'Manager' && employee.role !== 'Administrator')) {
      return NextResponse.json({ error: 'Forbidden - Manager or Administrator required' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 2MB' }, { status: 400 });
    }

    const isValidImage = await validateImageFile(file);
    if (!isValidImage) {
      return NextResponse.json({ error: 'Invalid image file' }, { status: 400 });
    }

    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'stage-icons');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const extension = file.type.split('/')[1]?.toLowerCase() || 'png';
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const finalExtension = validExtensions.includes(extension) ? extension : 'png';
    const filename = `icon-${timestamp}.${finalExtension}`;
    const filepath = join(uploadsDir, filename);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    const url = `/uploads/stage-icons/${filename}`;
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Stage management icon upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
