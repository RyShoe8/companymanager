import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import Operation from '@/lib/models/Operation';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds, migrateStagesToTasks, cleanupLaunchedProjectTasks } from '@/lib/utils/apiHelpers';
import { Types } from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    // Get user's organizationId
    const User = (await import('@/lib/models/User')).default;
    const Employee = (await import('@/lib/models/Employee')).default;
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Get current user's employee record and role
    const currentUserEmployee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    const userRole = currentUserEmployee?.role || 'User';

    // Find all users in the same organization
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Don't filter by timeframeType - projects should appear based on their date range
    // timeframeType is just metadata about the view they were created in
    const query: any = { userId: { $in: orgUserIds } };
    if (status) {
      query.status = status;
    }

    // Role-based filtering:
    // - Administrators: see all projects (no additional filter)
    // - Managers: see only projects they created (filter by userId)
    // - Users: see only projects they're assigned to
    if (userRole === 'Administrator') {
      // Administrators see all projects - no additional filtering needed
    } else if (userRole === 'Manager') {
      // Managers see only projects they created
      query.userId = new Types.ObjectId(session.userId);
    } else {
      // Users see only projects they're assigned to
      if (currentUserEmployee) {
        const employeeName = currentUserEmployee.name;
        // Keep the userId filter and add assignment filters
        query.$and = [
          { userId: { $in: orgUserIds } },
          {
            $or: [
              { assignedTo: employeeName },
              { 'tasks.assignedTo': employeeName },
              { 'stages.assignedTo': employeeName } // Backward compatibility
            ]
          }
        ];
        // Remove the userId filter from top level since it's now in $and
        delete query.userId;
      } else {
        // If no employee record, return empty array
        query._id = { $exists: false };
      }
    }

    const projects = await Project.find(query).sort({ startDate: 1 }).lean();
    
    // Migrate stages to tasks for backward compatibility and clean up launched projects
    const migratedProjects = await Promise.all(projects.map(async (project: any) => {
      // Migrate stages to tasks
      const migratedProject = migrateStagesToTasks(project);
      if (migratedProject !== project) {
        // Save migration if it occurred (async, don't wait)
        Project.findByIdAndUpdate(project._id, { tasks: migratedProject.tasks }, { new: true }).catch((err: any) => 
          console.error('Error saving migration:', err)
        );
      }
      
      // Clean up: If project is launched and has operations, clear tasks to avoid duplicates
      await cleanupLaunchedProjectTasks(project._id, project.status, project.tasks);
      
      // Return project with tasks cleared if cleanup occurred
      if (project.status === 'launched' && project.tasks && project.tasks.length > 0) {
        const existingOperations = await Operation.find({ projectId: project._id }).lean();
        if (existingOperations.length > 0) {
          project.tasks = [];
        }
      }
      
      return migratedProject;
    }));

    return NextResponse.json(migratedProjects);
  } catch (error) {
    console.error('Get projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    // Check if user is a Manager or Administrator
    const User = (await import('@/lib/models/User')).default;
    const Employee = (await import('@/lib/models/Employee')).default;
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const currentUserEmployee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    const isManagerOrAdmin = currentUserEmployee && (currentUserEmployee.role === 'Manager' || currentUserEmployee.role === 'Administrator');

    if (!isManagerOrAdmin) {
      return NextResponse.json({ error: 'Only Managers and Administrators can create projects' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, url, urls, startDate, endDate, timeframeType, color, status, estimatedHours, assignedTo, tasks } = body;

    if (!name || !startDate || !endDate || !timeframeType) {
      return NextResponse.json(
        { error: 'Name, startDate, endDate, and timeframeType are required' },
        { status: 400 }
      );
    }

    const projectData: any = {
      name,
      description,
      urls: urls || [],
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      timeframeType,
      color: color || '#3b82f6',
      status: status || 'planning',
      userId: session.userId,
    };

    if (estimatedHours !== undefined) {
      projectData.estimatedHours = estimatedHours;
    }

    if (assignedTo) {
      projectData.assignedTo = assignedTo;
    }

    if (tasks && Array.isArray(tasks)) {
      projectData.tasks = tasks.map((task: any) => ({
        ...task,
        startDate: new Date(task.startDate),
        endDate: new Date(task.endDate),
      }));
    }

    const project = await Project.create(projectData);

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
