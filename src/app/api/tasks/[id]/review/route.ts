import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import { requireAuth } from '@/lib/auth/middleware';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';

/**
 * POST /api/tasks/[id]/review
 * Submit a task for review
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const { projectId, taskIndex } = body;

    if (!projectId || taskIndex === undefined) {
      return NextResponse.json(
        { error: 'projectId and taskIndex are required' },
        { status: 400 }
      );
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is assigned to this task
    const user = await User.findById(session.userId);
    const employee = await Employee.findOne({ userId: session.userId, organizationId: user?.organizationId });
    
    if (!project.tasks || !project.tasks[taskIndex]) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = project.tasks[taskIndex];
    const isAssigned = 
      task.assignedToEmployeeId?.toString() === employee?._id.toString() ||
      task.assignedTo === employee?.name;

    if (!isAssigned) {
      return NextResponse.json(
        { error: 'You can only submit tasks assigned to you for review' },
        { status: 403 }
      );
    }

    // Update task status to in-review
    project.tasks[taskIndex].status = 'in-review';
    await project.save();

    return NextResponse.json({ success: true, task: project.tasks[taskIndex] });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/tasks/[id]/review
 * Approve or decline a task review
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const { projectId, taskIndex, approved } = body;

    if (!projectId || taskIndex === undefined || approved === undefined) {
      return NextResponse.json(
        { error: 'projectId, taskIndex, and approved are required' },
        { status: 400 }
      );
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if user is a Manager or Administrator assigned to the project
    const user = await User.findById(session.userId);
    const employee = await Employee.findOne({ userId: session.userId, organizationId: user?.organizationId });
    
    if (!employee || (employee.role !== 'Manager' && employee.role !== 'Administrator')) {
      return NextResponse.json(
        { error: 'Only Managers and Administrators can approve reviews' },
        { status: 403 }
      );
    }

    // Check if employee is assigned to the project
    const isAssignedToProject = 
      project.assignedToEmployeeIds?.some((id: any) => id.toString() === employee._id.toString()) ||
      project.assignedToEmployeeId?.toString() === employee._id.toString() ||
      project.assignedToNames?.includes(employee.name) ||
      project.assignedTo === employee.name;

    if (!isAssignedToProject) {
      return NextResponse.json(
        { error: 'You must be assigned to the project to approve reviews' },
        { status: 403 }
      );
    }

    if (!project.tasks || !project.tasks[taskIndex]) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Update task status
    if (approved) {
      project.tasks[taskIndex].status = 'completed';
    } else {
      project.tasks[taskIndex].status = 'active';
    }
    
    await project.save();

    return NextResponse.json({ success: true, task: project.tasks[taskIndex] });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
