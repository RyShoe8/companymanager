import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Wireframe from '@/lib/models/Wireframe';
import Project from '@/lib/models/Project';
import User from '@/lib/models/User';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import { Types } from 'mongoose';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    // Get user's organizationId
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Find all users in the same organization
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);

    // Get wireframe
    const wireframe = await Wireframe.findById(id).lean();
    if (!wireframe) {
      return NextResponse.json({ error: 'Wireframe not found' }, { status: 404 });
    }

    // Verify user has access to the project
    const project = await Project.findOne({ _id: wireframe.projectId, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Migrate old wireframes: convert pages with 'components' to 'sections'
    if (wireframe.pages && Array.isArray(wireframe.pages)) {
      const migratedPages = wireframe.pages.map((page: any) => {
        // If page has 'components' but no 'sections', migrate it
        if (page.components && !page.sections) {
          // Convert each component to a section
          const sections = page.components.map((comp: any) => {
            // Determine section type from component type
            let sectionType = 'content';
            if (comp.type === 'header') sectionType = 'header';
            else if (comp.type === 'footer') sectionType = 'footer';
            else if (comp.type === 'nav') sectionType = 'nav';
            else sectionType = 'content';

            return {
              id: `section-${comp.id}`,
              type: sectionType,
              label: comp.label || sectionType.charAt(0).toUpperCase() + sectionType.slice(1),
              x: comp.x || 0,
              y: comp.y || 0,
              width: comp.width || 1200,
              height: comp.height || 200,
              components: [], // Empty components array - user can add components later
              props: comp.props || {},
            };
          });

          return {
            ...page,
            sections: sections,
            // Remove old components field
            components: undefined,
          };
        }
        // If page already has sections, return as-is
        return page;
      });

      // If migration occurred, update the wireframe in the database
      const needsMigration = wireframe.pages.some((page: any) => page.components && !page.sections);
      if (needsMigration) {
        // Clean up migrated pages to remove components field
        const cleanedPages = migratedPages.map((page: any) => {
          const { components, ...rest } = page;
          return rest;
        });
        await Wireframe.updateOne(
          { _id: wireframe._id },
          { $set: { pages: cleanedPages } }
        );
        wireframe.pages = cleanedPages;
      }
    }

    return NextResponse.json(wireframe);
  } catch (error) {
    console.error('Error fetching wireframe:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    const body = await request.json();
    const { sourceType, externalUrl, pages, connections } = body;

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
      return NextResponse.json({ error: 'Only Managers and Administrators can edit wireframes' }, { status: 403 });
    }

    // Find all users in the same organization
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);

    // Get wireframe
    const wireframe = await Wireframe.findById(id);
    if (!wireframe) {
      return NextResponse.json({ error: 'Wireframe not found' }, { status: 404 });
    }

    // Verify user has access to the project
    const project = await Project.findOne({ _id: wireframe.projectId, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Update wireframe fields
    if (sourceType !== undefined) {
      if (!['builtin', 'external'].includes(sourceType)) {
        return NextResponse.json({ error: 'sourceType must be "builtin" or "external"' }, { status: 400 });
      }
      wireframe.sourceType = sourceType;
    }

    if (externalUrl !== undefined) {
      wireframe.externalUrl = externalUrl;
    }

    if (pages !== undefined) {
      wireframe.pages = pages;
    }

    if (connections !== undefined) {
      wireframe.connections = connections;
    }

    // Update metadata
    const userIdObjectId = new Types.ObjectId(session.userId);
    if (wireframe.metadata) {
      wireframe.metadata.version = (wireframe.metadata.version || 1) + 1;
      wireframe.metadata.lastEditedBy = userIdObjectId;
    } else {
      wireframe.metadata = {
        version: 1,
        lastEditedBy: userIdObjectId,
      };
    }

    await wireframe.save();

    // Return the updated wireframe with all fields including x/y positions
    const updatedWireframe = await Wireframe.findById(id).lean();
    return NextResponse.json(updatedWireframe);
  } catch (error) {
    console.error('Error updating wireframe:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

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
      return NextResponse.json({ error: 'Only Managers and Administrators can delete wireframes' }, { status: 403 });
    }

    // Find all users in the same organization
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);

    // Get wireframe
    const wireframe = await Wireframe.findById(id);
    if (!wireframe) {
      return NextResponse.json({ error: 'Wireframe not found' }, { status: 404 });
    }

    // Verify user has access to the project
    const project = await Project.findOne({ _id: wireframe.projectId, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await Wireframe.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Wireframe deleted successfully' });
  } catch (error) {
    console.error('Error deleting wireframe:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
