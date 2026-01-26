import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Operation from '@/lib/models/Operation';
import Project from '@/lib/models/Project';
import { requireAuth } from '@/lib/auth/middleware';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';

/**
 * POST /api/operations/[id]/review
 * Submit an operation for review
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

    const operation = await Operation.findById(id);
    if (!operation) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    // Check if user is assigned to this operation
    const user = await User.findById(session.userId);
    const employee = await Employee.findOne({ userId: session.userId, organizationId: user?.organizationId });
    
    const isAssigned = 
      operation.assignedToEmployeeId?.toString() === employee?._id.toString() ||
      operation.assignedTo === employee?.name;

    if (!isAssigned) {
      return NextResponse.json(
        { error: 'You can only submit operations assigned to you for review' },
        { status: 403 }
      );
    }

    // Update operation status to in-review
    operation.status = 'in-review';
    await operation.save();

    return NextResponse.json({ success: true, operation });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/operations/[id]/review
 * Approve or decline an operation review
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
    const { approved } = body;

    if (approved === undefined) {
      return NextResponse.json(
        { error: 'approved is required' },
        { status: 400 }
      );
    }

    const operation = await Operation.findById(id);
    if (!operation) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    // Check if user is a Manager or Administrator
    const user = await User.findById(session.userId);
    const employee = await Employee.findOne({ userId: session.userId, organizationId: user?.organizationId });
    
    if (!employee || (employee.role !== 'Manager' && employee.role !== 'Administrator')) {
      return NextResponse.json(
        { error: 'Only Managers and Administrators can approve reviews' },
        { status: 403 }
      );
    }

    // If operation is linked to a project, check if employee is assigned to the project
    if (operation.projectId) {
      const project = await Project.findById(operation.projectId);
      if (project) {
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
      }
    }

    // Update operation status
    if (approved) {
      operation.status = 'completed';
    } else {
      operation.status = 'active';
    }
    
    await operation.save();

    return NextResponse.json({ success: true, operation });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
