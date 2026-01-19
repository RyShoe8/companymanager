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
    // - Administrators: see all projects in organization (already filtered by userId: { $in: orgUserIds })
    // - Managers: see only projects they created (filter by userId)
    // - Users: see only projects they're assigned to
    if (userRole === 'Administrator') {
      // Administrators see all projects in their organization
      // The userId: { $in: orgUserIds } filter already ensures they only see org projects
      // But if they have an employee record, also include projects assigned to them (even if created outside org)
      if (currentUserEmployee) {
        const employeeId = currentUserEmployee._id;
        // Use $or to include both org projects AND projects assigned to them
        query.$or = [
          { userId: { $in: orgUserIds } },
          { assignedToEmployeeId: employeeId },
          { 'tasks.assignedToEmployeeId': employeeId },
          // Legacy support for name-based assignments
          { assignedTo: currentUserEmployee.name },
          { 'tasks.assignedTo': currentUserEmployee.name },
          { 'stages.assignedTo': currentUserEmployee.name }
        ];
        // Remove the userId filter from top level since it's now in $or
        delete query.userId;
      }
    } else if (userRole === 'Manager') {
      // Managers see only projects they created
      query.userId = new Types.ObjectId(session.userId);
    } else {
      // Users see only projects they're assigned to
      if (currentUserEmployee) {
        const employeeId = currentUserEmployee._id;
        // Keep the userId filter and add assignment filters
        query.$and = [
          { userId: { $in: orgUserIds } },
          {
            $or: [
              { assignedToEmployeeId: employeeId },
              { 'tasks.assignedToEmployeeId': employeeId },
              // Legacy support for name-based assignments
              { assignedTo: currentUserEmployee.name },
              { 'tasks.assignedTo': currentUserEmployee.name },
              { 'stages.assignedTo': currentUserEmployee.name }
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
          // Error saving migration
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
    // Get projects error
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
    const { name, description, url, urls, startDate, endDate, timeframeType, color, status, estimatedHours, assignedTo, assignedToEmployeeId, tasks } = body;

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

    // Handle employee assignment - prefer employeeId over name
    if (assignedToEmployeeId) {
      projectData.assignedToEmployeeId = new Types.ObjectId(assignedToEmployeeId);
      // Also set name for backward compatibility if employee exists
      const Employee = (await import('@/lib/models/Employee')).default;
      const assignedEmployee = await Employee.findById(assignedToEmployeeId);
      if (assignedEmployee) {
        projectData.assignedTo = assignedEmployee.name;
      }
    } else if (assignedTo) {
      // Legacy support: if name provided, try to find employee and set ID
      const Employee = (await import('@/lib/models/Employee')).default;
      const assignedEmployee = await Employee.findOne({ 
        name: assignedTo, 
        organizationId: user.organizationId 
      });
      if (assignedEmployee) {
        projectData.assignedToEmployeeId = assignedEmployee._id;
      }
      projectData.assignedTo = assignedTo;
    }

    if (tasks && Array.isArray(tasks)) {
      const Employee = (await import('@/lib/models/Employee')).default;
      projectData.tasks = await Promise.all(tasks.map(async (task: any) => {
        const taskData: any = {
          ...task,
          startDate: new Date(task.startDate),
          endDate: new Date(task.endDate),
        };
        
        // Handle employee assignment for tasks - prefer employeeId over name
        if (task.assignedToEmployeeId) {
          taskData.assignedToEmployeeId = new Types.ObjectId(task.assignedToEmployeeId);
          const assignedEmployee = await Employee.findById(task.assignedToEmployeeId);
          if (assignedEmployee) {
            taskData.assignedTo = assignedEmployee.name;
          }
        } else if (task.assignedTo) {
          // Legacy support: if name provided, try to find employee and set ID
          const assignedEmployee = await Employee.findOne({ 
            name: task.assignedTo, 
            organizationId: user.organizationId 
          });
          if (assignedEmployee) {
            taskData.assignedToEmployeeId = assignedEmployee._id;
          }
          taskData.assignedTo = task.assignedTo;
        }
        
        return taskData;
      }));
    }

    const project = await Project.create(projectData);

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    // Create project error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
