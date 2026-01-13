import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Operation from '@/lib/models/Operation';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    // Get user's organizationId
    const User = (await import('@/lib/models/User')).default;
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Find all users in the same organization
    const orgUsers = await User.find({ organizationId: user.organizationId });
    const orgUserIds = orgUsers.map(u => u._id);

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

    const body = await request.json();
    const { name, description, url, recurrenceType, status, assignedTo, estimatedHours, startDate, endDate } = body;

    if (!name || !recurrenceType) {
      return NextResponse.json({ error: 'Name and recurrenceType are required' }, { status: 400 });
    }

    await connectDB();

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
