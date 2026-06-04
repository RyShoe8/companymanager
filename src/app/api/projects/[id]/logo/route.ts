import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import User from '@/lib/models/User';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { validateImageFile, isValidObjectId } from '@/lib/utils/security';
import { getOrganizationUserIds, migrateProjectFields } from '@/lib/utils/apiHelpers';
import { deleteStoredFile } from '@/lib/storage/deleteStoredFile';
import { put } from '@vercel/blob';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    // Get user's organizationId
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Check if user is a Manager or Administrator
    const Employee = (await import('@/lib/models/Employee')).default;
    const currentUserEmployee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    const isManagerOrAdmin = currentUserEmployee && (currentUserEmployee.role === 'Manager' || currentUserEmployee.role === 'Administrator');

    if (!isManagerOrAdmin) {
      return NextResponse.json({ error: 'Only Managers and Administrators can upload project logos' }, { status: 403 });
    }

    // Find all users in the same organization
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);

    // Verify project exists and user has access
    const project = await Project.findOne({ _id: id, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type by MIME type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
    }

    // Validate file content by checking magic bytes
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
      // Production (e.g. Vercel): use Blob storage (filesystem is read-only)
      const blob = await put(`projects/${filename}`, file, {
        access: 'public',
        contentType: file.type,
      });
      url = blob.url;
    } else {
      // Local dev: use filesystem under public/uploads
      const uploadsDir = join(process.cwd(), 'public', 'uploads', 'projects');
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }
      const filepath = join(uploadsDir, filename);
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filepath, buffer);
      const { existsSync: checkExists } = await import('fs');
      if (!checkExists(filepath)) {
        throw new Error('Failed to save file');
      }
      url = `/uploads/projects/${filename}`;
    }

    project.logo = url;
    migrateProjectFields(project);
    await project.save();

    return NextResponse.json({
      message: 'Project logo uploaded successfully',
      url,
    });
  } catch (error) {
    console.error('Error uploading project logo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    // Get user's organizationId
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Check if user is a Manager or Administrator
    const Employee = (await import('@/lib/models/Employee')).default;
    const currentUserEmployee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    const isManagerOrAdmin = currentUserEmployee && (currentUserEmployee.role === 'Manager' || currentUserEmployee.role === 'Administrator');

    if (!isManagerOrAdmin) {
      return NextResponse.json({ error: 'Only Managers and Administrators can delete project logos' }, { status: 403 });
    }

    // Find all users in the same organization
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);

    // Verify project exists and user has access
    const project = await Project.findOne({ _id: id, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Delete logo file if it exists
    if (project.logo) {
      await deleteStoredFile(project.logo);
    }

    // Remove logo from project
    project.logo = undefined;
    migrateProjectFields(project);
    await project.save();

    return NextResponse.json({
      message: 'Project logo deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting project logo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
