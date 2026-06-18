import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import Client from '@/lib/models/Client';
import { requireAuth } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    const User = (await import('@/lib/models/User')).default;
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const Employee = (await import('@/lib/models/Employee')).default;
    const currentUserEmployee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    if (currentUserEmployee?.role !== 'Administrator') {
      return NextResponse.json({ error: 'Only administrators can migrate data' }, { status: 403 });
    }

    // Find all projects that are of type 'client' but have no clientId
    const projectsToMigrate = await Project.find({
      organizationId: user.organizationId,
      projectType: 'client',
      clientId: { $exists: false },
    });

    let migratedCount = 0;

    for (const project of projectsToMigrate) {
      // Check if a client with the same name already exists to avoid duplicates
      let client = await Client.findOne({ organizationId: user.organizationId, name: project.name });

      if (!client) {
        // Create a new client based on the project's details
        client = await Client.create({
          organizationId: user.organizationId,
          name: project.name,
          domain: project.url || project.urls?.[0], // use the primary url as domain
          logo: project.logo,
          color: project.color,
          status: 'active',
          userIds: project.userId ? [project.userId] : [],
        });
      }

      // Link project to client
      project.clientId = client._id;
      await project.save();
      migratedCount++;
    }

    return NextResponse.json({ success: true, migratedCount });
  } catch (error) {
    console.error('Failed to migrate clients:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
