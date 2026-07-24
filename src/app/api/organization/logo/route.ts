import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import Organization from '@/lib/models/Organization';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { validateImageFile } from '@/lib/utils/security';
import { put, del } from '@vercel/blob';

async function getOrgAdminOrganization(sessionUserId: string) {
  const user = await User.findById(sessionUserId);
  if (!user || !user.organizationId) {
    return { error: 'User or organization not found', status: 404 as const };
  }

  const isAdmin = user._id.toString() === user.organizationId;
  if (!isAdmin) {
    return { error: 'Only organization administrators can manage organization logos', status: 403 as const };
  }

  const organization = await Organization.findOne({ userId: user._id });
  if (!organization) {
    return { error: 'Organization not found', status: 404 as const };
  }

  return { organization, user };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const result = await getOrgAdminOrganization(session.userId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { organization } = result;
    const adminUserId = organization.userId.toString();

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
    const extension = file.type.split('/')[1]?.toLowerCase() || 'jpg';
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const finalExtension = validExtensions.includes(extension) ? extension : 'jpg';
    const filename = `${adminUserId}-${timestamp}.${finalExtension}`;

    let url: string;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`organizations/${filename}`, file, {
        access: 'public',
        contentType: file.type,
      });
      url = blob.url;
    } else {
      const uploadsDir = join(process.cwd(), 'public', 'uploads', 'organizations');
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }
      const filepath = join(uploadsDir, filename);
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filepath, buffer);
      url = `/uploads/organizations/${filename}`;
    }

    organization.logo = url;
    await organization.save();

    return NextResponse.json({
      message: 'Organization logo uploaded successfully',
      url,
    });
  } catch (error) {
    console.error('Error uploading organization logo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const result = await getOrgAdminOrganization(session.userId);
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { organization } = result;

    if (organization.logo) {
      try {
        if (organization.logo.startsWith('https://')) {
          await del(organization.logo);
        } else {
          const { unlink } = await import('fs/promises');
          const logoPath = join(process.cwd(), 'public', organization.logo);
          if (existsSync(logoPath)) {
            await unlink(logoPath);
          }
        }
      } catch (error) {
        console.error('Error deleting organization logo file:', error);
      }
    }

    organization.logo = undefined;
    await organization.save();

    return NextResponse.json({
      message: 'Organization logo deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting organization logo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
