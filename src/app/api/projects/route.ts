import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds, migrateStagesToTasks } from '@/lib/utils/apiHelpers';
import { getDefaultTaskDates, parseDateSafe } from '@/lib/utils/dateUtils';
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
    // - Managers: see all projects in organization (same as Administrators)
    // - Users: see only projects they're assigned to
    if (userRole === 'Administrator' || userRole === 'Manager') {
      // Administrators and Managers see all projects in their organization
      // The userId: { $in: orgUserIds } filter already ensures they only see org projects
      // But if they have an employee record, also include projects assigned to them (even if created outside org)
      if (currentUserEmployee) {
        const employeeId = currentUserEmployee._id;
        // Use $or to include both org projects AND projects assigned to them
        query.$or = [
          { userId: { $in: orgUserIds } },
          { assignedToEmployeeId: employeeId },
          { assignedToEmployeeIds: employeeId },
          { 'tasks.assignedToEmployeeId': employeeId },
          // Legacy support for name-based assignments
          { assignedTo: currentUserEmployee.name },
          { assignedToNames: currentUserEmployee.name },
          { 'tasks.assignedTo': currentUserEmployee.name },
          { 'stages.assignedTo': currentUserEmployee.name }
        ];
        // Remove the userId filter from top level since it's now in $or
        delete query.userId;
      }
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
              { assignedToEmployeeIds: employeeId },
              { 'tasks.assignedToEmployeeId': employeeId },
              // Legacy support for name-based assignments
              { assignedTo: currentUserEmployee.name },
              { assignedToNames: currentUserEmployee.name },
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

    const projects = await Project.find(query).sort({ createdAt: -1 }).lean();

    // Migrate stages to tasks for backward compatibility and clean up launched projects
    const migratedProjects = await Promise.all(projects.map(async (project: any) => {
      // Migrate stages to tasks
      const migratedProject = migrateStagesToTasks(project);
      if (migratedProject !== project) {
        // Save migration if it occurred (async, don't wait)
        Project.findByIdAndUpdate(project._id, { tasks: migratedProject.tasks }, { new: true }).catch(() => {
          // Error saving migration
        });
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
    const { name, description, url, urls, projectType, color, logo, status, estimatedHours, assignedTo, assignedToEmployeeId, assignedToEmployeeIds, assignedToNames, tasks, endDate } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const projectData: any = {
      name,
      description,
      urls: urls || [],
      projectType: projectType || 'generic',
      color: color || '#3b82f6',
      logo: logo || undefined,
      status: status || 'planning',
      userId: session.userId,
    };

    if (endDate !== undefined && endDate !== null && endDate !== '') {
      projectData.endDate = new Date(endDate);
    }

    if (estimatedHours !== undefined) {
      projectData.estimatedHours = estimatedHours;
    }

    // Handle multiple employee assignments (preferred)
    if (assignedToEmployeeIds && Array.isArray(assignedToEmployeeIds) && assignedToEmployeeIds.length > 0) {
      projectData.assignedToEmployeeIds = assignedToEmployeeIds.map((id: string) => new Types.ObjectId(id));
      if (assignedToNames && Array.isArray(assignedToNames) && assignedToNames.length > 0) {
        projectData.assignedToNames = assignedToNames;
      } else {
        // Fetch names from employee records
        const assignedEmployees = await Employee.find({ _id: { $in: projectData.assignedToEmployeeIds } });
        projectData.assignedToNames = assignedEmployees.map(emp => emp.name);
      }
      // Keep legacy fields for backward compatibility (use first assignment)
      projectData.assignedToEmployeeId = projectData.assignedToEmployeeIds[0];
      projectData.assignedTo = projectData.assignedToNames[0];
    } else if (assignedToEmployeeId) {
      // Legacy single assignment support
      projectData.assignedToEmployeeId = new Types.ObjectId(assignedToEmployeeId);
      const assignedEmployee = await Employee.findById(assignedToEmployeeId);
      if (assignedEmployee) {
        projectData.assignedTo = assignedEmployee.name;
      }
    } else if (assignedTo) {
      // Legacy support: if name provided, try to find employee and set ID
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
      projectData.tasks = await Promise.all(tasks.map(async (task: any) => {
        const defaultDates = getDefaultTaskDates();
        let startDate = parseDateSafe(task.startDate) || defaultDates.startDate;
        let endDate = parseDateSafe(task.endDate) || defaultDates.endDate;

        // Normalize dates to midnight UTC for comparison (ignore time component)
        if (startDate) {
          startDate = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()));
        }
        if (endDate) {
          endDate = new Date(Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()));
        }

        // Validate end date is after or equal to start date (allow same day)
        if (endDate < startDate) {
          throw new Error(`Task "${task.name || 'Untitled Task'}": End date must be after or equal to start date`);
        }

        const taskData: any = {
          ...task,
          startDate,
          endDate,
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
    console.error('Error creating project:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
