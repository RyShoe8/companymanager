import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { put } from '@vercel/blob';
import { requireAdminUser } from '@/lib/blog/requireAdmin';
import { validateImageFile } from '@/lib/utils/security';
import { blogApiErrorResponse } from '@/lib/blog/blogApiErrorResponse';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminUser();
    if (auth.error) return auth.error;

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
    }

    const isValidImage = await validateImageFile(file);
    if (!isValidImage) {
      return NextResponse.json({ error: 'Invalid image file' }, { status: 400 });
    }

    const timestamp = Date.now();
    const extension = file.type.split('/')[1]?.toLowerCase() || 'png';
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const finalExtension = validExtensions.includes(extension) ? extension : 'png';
    const filename = `blog-${timestamp}.${finalExtension}`;

    let url: string;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`blog/${filename}`, file, {
        access: 'public',
        contentType: file.type,
      });
      url = blob.url;
    } else {
      const uploadsDir = join(process.cwd(), 'public', 'uploads', 'blog');
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }
      const filepath = join(uploadsDir, filename);
      const bytes = await file.arrayBuffer();
      await writeFile(filepath, Buffer.from(bytes));
      url = `/uploads/blog/${filename}`;
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Blog image upload error:', error);
    const { message, status } = blogApiErrorResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}
