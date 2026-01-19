import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Operation from '@/lib/models/Operation';
import { requireAuth } from '@/lib/auth/middleware';
import { sanitizeString } from '@/lib/utils/security';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
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
    const recurrenceType = searchParams.get('recurrenceType');
    const status = searchParams.get('status');

    const query: any = { userId: { $in: orgUserIds } };
    if (recurrenceType) {
      query.recurrenceType = recurrenceType;
    }
    if (status) {
      query.status = status;
    }

    // Role-based filtering:
    // - Administrators: see all operations (no additional filter)
    // - Managers: see only operations they created (filter by userId)
    // - Users: see only operations they're assigned to
    if (userRole === 'Administrator') {
      // Administrators see all operations in their organization
      // But if they have an employee record, also include operations assigned to them
      if (currentUserEmployee) {
        const employeeName = currentUserEmployee.name;
        // Use $or to include both org operations AND operations assigned to them
        query.$or = [
          { userId: { $in: orgUserIds } },
          { assignedTo: employeeName }
        ];
        // Remove the userId filter from top level since it's now in $or
        delete query.userId;
      }
    } else if (userRole === 'Manager') {
      // Managers see only operations they created
      query.userId = new Types.ObjectId(session.userId);
    } else {
      // Users see only operations they're assigned to
      if (currentUserEmployee) {
        query.assignedTo = currentUserEmployee.name;
      } else {
        // If no employee record, return empty array
        query._id = { $exists: false };
      }
    }

    const operations = await Operation.find(query).sort({ createdAt: -1 });

    return NextResponse.json(operations);
  } catch (error) {
    console.error('Get operations error:', error);
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
      return NextResponse.json({ error: 'Only Managers and Administrators can create operations' }, { status: 403 });
    }

    const body = await request.json();
    let { name, description, url, recurrenceType, status, assignedTo, estimatedHours, startDate, endDate } = body;

    // Sanitize string inputs
    name = sanitizeString(name, 200);
    description = description ? sanitizeString(description, 2000) : undefined;
    url = url ? sanitizeString(url, 500) : undefined;
    assignedTo = assignedTo ? sanitizeString(assignedTo, 100) : undefined;

    if (!name || !recurrenceType) {
      return NextResponse.json({ error: 'Name and recurrenceType are required' }, { status: 400 });
    }

    // Validate recurrenceType
    const validRecurrenceTypes = ['none', 'weekly', 'bi-weekly', 'monthly'];
    if (!validRecurrenceTypes.includes(recurrenceType)) {
      return NextResponse.json({ error: 'Invalid recurrenceType' }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['planning', 'active', 'in-review', 'completed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Validate dates if provided
    if (startDate) {
      const start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return NextResponse.json({ error: 'Invalid start date format' }, { status: 400 });
      }
    }
    if (endDate) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return NextResponse.json({ error: 'Invalid end date format' }, { status: 400 });
      }
      if (startDate && new Date(startDate) > end) {
        return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 });
      }
    }

    const operationData: any = {
      name,
      description,
      url,
      recurrenceType,
      status: status || 'planning',
      userId: session.userId,
    };

    if (assignedTo) {
      operationData.assignedTo = assignedTo;
    }
    if (estimatedHours !== undefined) {
      operationData.estimatedHours = estimatedHours;
    }
    if (startDate) {
      operationData.startDate = new Date(startDate);
    }
    if (endDate) {
      operationData.endDate = new Date(endDate);
    }

    const operation = await Operation.create(operationData);

    return NextResponse.json(operation, { status: 201 });
  } catch (error) {
    console.error('Create operation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
