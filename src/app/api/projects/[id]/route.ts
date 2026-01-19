import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import Operation from '@/lib/models/Operation';
import User from '@/lib/models/User';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds, migrateStagesToTasks, cleanupLaunchedProjectTasks } from '@/lib/utils/apiHelpers';
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

    const project = await Project.findOne({ _id: id, userId: { $in: orgUserIds } }).lean();
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Migrate stages to tasks for backward compatibility
    const migratedProject = migrateStagesToTasks(project);
    if (migratedProject !== project) {
      // Save migration if it occurred (async, don't wait)
      Project.findByIdAndUpdate(id, { tasks: (migratedProject as any).tasks }, { new: true }).catch(() => {
        // Error saving migration
      });
    }
    
    // Clean up: If project is launched and has operations, clear tasks to avoid duplicates
    await cleanupLaunchedProjectTasks(id, project.status, project.tasks);
    
    // Return project with tasks cleared if cleanup occurred
    const finalProject = migratedProject;
    if (finalProject.status === 'launched' && finalProject.tasks && finalProject.tasks.length > 0) {
      const existingOperations = await Operation.find({ projectId: id }).lean();
      if (existingOperations.length > 0) {
        (finalProject as any).tasks = [];
      }
    }
    
    return NextResponse.json(finalProject);
  } catch (error) {
    // Get project error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const { name, description, url, urls, startDate, endDate, timeframeType, color, status, estimatedHours, assignedTo, assignedToEmployeeId, tasks } = body;

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

    // Find all users in the same organization
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);

    const project = await Project.findOne({ _id: id, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // If user is not a Manager or Administrator, only allow status change from active to in-review
    if (!isManagerOrAdmin) {
      if (currentUserEmployee?.role !== 'User') {
        return NextResponse.json({ error: 'Only Managers, Administrators, and Users can update projects' }, { status: 403 });
      }
      
      // Regular users can only change status from in-development to in-review
      if (status !== undefined && status !== project.status) {
        if (project.status !== 'in-development' || status !== 'in-review') {
          return NextResponse.json({ error: 'Users can only change status from in-development to in-review' }, { status: 403 });
        }
      }
      
      // Regular users cannot change other fields
      if (name !== undefined || description !== undefined || url !== undefined || urls !== undefined ||
          startDate !== undefined || endDate !== undefined || timeframeType !== undefined || 
          color !== undefined || estimatedHours !== undefined || assignedTo !== undefined || 
          assignedToEmployeeId !== undefined || tasks !== undefined) {
        return NextResponse.json({ error: 'Users can only change project status' }, { status: 403 });
      }
    }

    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;
    if (url !== undefined) project.url = url;
    if (urls !== undefined) project.urls = urls;
    if (startDate !== undefined) project.startDate = new Date(startDate);
    if (endDate !== undefined) project.endDate = new Date(endDate);
    if (timeframeType !== undefined) project.timeframeType = timeframeType;
    if (color !== undefined) project.color = color;
    const previousStatus = project.status;
    if (status !== undefined) project.status = status;
    if (estimatedHours !== undefined) {
      project.estimatedHours = estimatedHours === null || estimatedHours === '' ? undefined : estimatedHours;
    }
    // Handle employee assignment - prefer employeeId over name
    if (assignedToEmployeeId !== undefined) {
      if (assignedToEmployeeId === null || assignedToEmployeeId === '') {
        project.assignedToEmployeeId = undefined;
        project.assignedTo = undefined;
      } else {
        project.assignedToEmployeeId = new Types.ObjectId(assignedToEmployeeId);
        // Also set name for backward compatibility
        const assignedEmployee = await Employee.findById(assignedToEmployeeId);
        if (assignedEmployee) {
          project.assignedTo = assignedEmployee.name;
        }
      }
    } else if (assignedTo !== undefined) {
      // Legacy support: if name provided, try to find employee and set ID
      if (assignedTo === null || assignedTo === '') {
        project.assignedTo = undefined;
        project.assignedToEmployeeId = undefined;
      } else {
        const assignedEmployee = await Employee.findOne({ 
          name: assignedTo, 
          organizationId: user.organizationId 
        });
        if (assignedEmployee) {
          project.assignedToEmployeeId = assignedEmployee._id;
        }
        project.assignedTo = assignedTo;
      }
    }
    
    if (tasks !== undefined) {
      if (Array.isArray(tasks)) {
        project.tasks = await Promise.all(tasks.map(async (task: any) => {
          const taskData: any = {
            name: task.name,
            description: task.description || undefined,
            startDate: new Date(task.startDate),
            endDate: new Date(task.endDate),
            estimatedHours: task.estimatedHours || undefined,
            status: task.status || 'planning',
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
      } else {
        project.tasks = [];
      }
    }

    await project.save();

    // If project status changed to "launched", convert all tasks to operations
    if (status === 'launched' && previousStatus !== 'launched' && project.tasks && project.tasks.length > 0) {
      try {
        // Check if operations already exist for this project to avoid duplicates
        const existingOperations = await Operation.find({ projectId: project._id });
        if (existingOperations.length === 0) {
          // Convert each task to an operation
          const operationsToCreate = project.tasks.map((task: any) => ({
            name: task.name,
            description: task.description,
            recurrenceType: 'none' as const,
            status: task.status === 'complete' ? 'complete' : task.status === 'active' ? 'active' : task.status === 'in-review' ? 'in-review' : 'planning',
            assignedTo: task.assignedTo, // Legacy support
            assignedToEmployeeId: task.assignedToEmployeeId, // Use employee ID
            estimatedHours: task.estimatedHours,
            startDate: task.startDate,
            endDate: task.endDate,
            projectId: project._id,
            userId: project.userId,
          }));

          await Operation.insertMany(operationsToCreate);
          
          // Clear tasks array since they've been converted to operations
          project.tasks = [];
          await project.save();
        }
      } catch (error) {
        // Error converting tasks to operations
        // Don't fail the project update if operation creation fails
      }
    }
    
    // Also clear tasks if project is already launched and has tasks (cleanup for existing data)
    if (project.status === 'launched' && project.tasks && project.tasks.length > 0) {
      const existingOperations = await Operation.find({ projectId: project._id });
      if (existingOperations.length > 0) {
        // If operations exist, clear tasks to avoid duplicates
        project.tasks = [];
        await project.save();
      }
    }

    return NextResponse.json(project);
  } catch (error) {
    // Update project error
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

    // Find all users in the same organization
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);

    const project = await Project.findOneAndDelete({ _id: id, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    // Delete project error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
