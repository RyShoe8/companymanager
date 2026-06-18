import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import Client from '@/lib/models/Client';
import Project from '@/lib/models/Project';
import User from '@/lib/models/User';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { validateImageFile, isValidObjectId } from '@/lib/utils/security';
import { deleteStoredFile } from '@/lib/storage/deleteStoredFile';
import { put } from '@vercel/blob';

async function requireManagerContext(sessionUserId: string) {
  const user = await User.findById(sessionUserId);
  if (!user?.organizationId) {
    return { error: NextResponse.json({ error: 'User or organization not found' }, { status: 404 }) };
  }

  const Employee = (await import('@/lib/models/Employee')).default;
  const employee = await Employee.findOne({ userId: sessionUserId, organizationId: user.organizationId });
  const isManagerOrAdmin =
    employee?.role === 'Manager' || employee?.role === 'Administrator';
  if (!isManagerOrAdmin) {
    return { error: NextResponse.json({ error: 'Only Managers and Administrators can manage client logos' }, { status: 403 }) };
  }

  return { user, employee };
}

async function syncClientLogoToHub(clientId: string, logo: string | undefined) {
  if (logo) {
    await Project.updateOne({ clientId, projectType: 'client-admin' }, { $set: { logo } });
  } else {
    await Project.updateOne({ clientId, projectType: 'client-admin' }, { $unset: { logo: 1 } });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
    }

    const ctx = await requireManagerContext(session.userId);
    if ('error' in ctx && ctx.error) return ctx.error;

    const client = await Client.findOne({ _id: id, organizationId: ctx.user!.organizationId });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

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
    const filename = `${id}-${timestamp}.${finalExtension}`;

    let url: string;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`clients/${filename}`, file, {
        access: 'public',
        contentType: file.type,
      });
      url = blob.url;
    } else {
      const uploadsDir = join(process.cwd(), 'public', 'uploads', 'clients');
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }
      const filepath = join(uploadsDir, filename);
      const bytes = await file.arrayBuffer();
      await writeFile(filepath, Buffer.from(bytes));
      url = `/uploads/clients/${filename}`;
    }

    if (client.logo) {
      await deleteStoredFile(client.logo);
    }

    client.logo = url;
    await client.save();
    await syncClientLogoToHub(id, url);

    return NextResponse.json({
      message: 'Client logo uploaded successfully',
      url,
    });
  } catch (error) {
    console.error('Error uploading client logo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
    }

    const ctx = await requireManagerContext(session.userId);
    if ('error' in ctx && ctx.error) return ctx.error;

    const client = await Client.findOne({ _id: id, organizationId: ctx.user!.organizationId });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (client.logo) {
      await deleteStoredFile(client.logo);
    }

    client.logo = undefined;
    await client.save();
    await syncClientLogoToHub(id, undefined);

    return NextResponse.json({ message: 'Client logo deleted successfully' });
  } catch (error) {
    console.error('Error deleting client logo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
