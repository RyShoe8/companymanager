import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Operation from '@/lib/models/Operation';
import User from '@/lib/models/User';
import { requireAuth } from '@/lib/auth/middleware';
import { isValidObjectId, sanitizeString } from '@/lib/utils/security';
import { Types } from 'mongoose';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid operation ID' }, { status: 400 });
    }

    // Get user's organizationId
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Find all users in the same organization
    const orgUsers = await User.find({ organizationId: user.organizationId });
    const orgUserIds = orgUsers.map(u => u._id);

    const operation = await Operation.findOne({ _id: id, userId: { $in: orgUserIds } });
    if (!operation) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    return NextResponse.json(operation);
  } catch (error) {
    console.error('Get operation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    let { name, description, url, recurrenceType, status, assignedTo, assignedToEmployeeId, estimatedHours, startDate, endDate } = body;

    await connectDB();
    const { id } = await params;

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid operation ID' }, { status: 400 });
    }

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid operation ID' }, { status: 400 });
    }

    // Get user's organizationId
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Find all users in the same organization
    const orgUsers = await User.find({ organizationId: user.organizationId });
    const orgUserIds = orgUsers.map(u => u._id);

    const operation = await Operation.findOne({ _id: id, userId: { $in: orgUserIds } });
    if (!operation) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    // Sanitize string inputs
    if (name !== undefined) operation.name = sanitizeString(name, 200);
    if (description !== undefined) operation.description = sanitizeString(description, 2000);
    if (url !== undefined) operation.url = sanitizeString(url, 500);
    if (recurrenceType !== undefined) {
      // Validate recurrenceType
      const validRecurrenceTypes = ['none', 'weekly', 'bi-weekly', 'monthly'];
      if (!validRecurrenceTypes.includes(recurrenceType)) {
        return NextResponse.json({ error: 'Invalid recurrenceType' }, { status: 400 });
      }
      operation.recurrenceType = recurrenceType;
    }
    if (status !== undefined) operation.status = status;
    
    // Handle employee assignment - prefer employeeId over name
    if (assignedToEmployeeId !== undefined) {
      if (assignedToEmployeeId === null || assignedToEmployeeId === '') {
        operation.assignedToEmployeeId = undefined;
        operation.assignedTo = undefined;
      } else {
        operation.assignedToEmployeeId = new Types.ObjectId(assignedToEmployeeId);
        // Also set name for backward compatibility
        const Employee = (await import('@/lib/models/Employee')).default;
        const assignedEmployee = await Employee.findById(assignedToEmployeeId);
        if (assignedEmployee) {
          operation.assignedTo = assignedEmployee.name;
        }
      }
    } else if (assignedTo !== undefined) {
      // Legacy support: if name provided, try to find employee and set ID
      if (assignedTo === '') {
        operation.assignedTo = undefined;
        operation.assignedToEmployeeId = undefined;
      } else {
        const Employee = (await import('@/lib/models/Employee')).default;
        const assignedEmployee = await Employee.findOne({ 
          name: assignedTo, 
          organizationId: user.organizationId 
        });
        if (assignedEmployee) {
          operation.assignedToEmployeeId = assignedEmployee._id;
        }
        operation.assignedTo = assignedTo;
      }
    }
    
    if (estimatedHours !== undefined) {
      operation.estimatedHours = estimatedHours === null || estimatedHours === '' ? undefined : estimatedHours;
    }
    if (startDate !== undefined) {
      operation.startDate = startDate === '' ? undefined : new Date(startDate);
    }
    if (endDate !== undefined) {
      operation.endDate = endDate === '' ? undefined : new Date(endDate);
    }

    await operation.save();

    return NextResponse.json(operation);
  } catch (error) {
    console.error('Update operation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid operation ID' }, { status: 400 });
    }

    // Get user's organizationId
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Find all users in the same organization
    const orgUsers = await User.find({ organizationId: user.organizationId });
    const orgUserIds = orgUsers.map(u => u._id);

    const operation = await Operation.findOneAndDelete({ _id: id, userId: { $in: orgUserIds } });
    if (!operation) {
      return NextResponse.json({ error: 'Operation not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Operation deleted successfully' });
  } catch (error) {
    console.error('Delete operation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
