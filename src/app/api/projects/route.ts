import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import { requireAuth } from '@/lib/auth/middleware';
import { sanitizeString } from '@/lib/utils/security';

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

    // Check if user is a Manager or Administrator
    const currentUserEmployee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    const isManagerOrAdmin = currentUserEmployee && (currentUserEmployee.role === 'Manager' || currentUserEmployee.role === 'Administrator');

    // Find all users in the same organization
    const orgUsers = await User.find({ organizationId: user.organizationId });
    const orgUserIds = orgUsers.map(u => u._id);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Don't filter by timeframeType - projects should appear based on their date range
    // timeframeType is just metadata about the view they were created in
    const query: any = { userId: { $in: orgUserIds } };
    if (status) {
      query.status = status;
    }

    // If user is not a Manager or Administrator, filter to only assigned projects
    if (!isManagerOrAdmin && currentUserEmployee) {
      const employeeName = currentUserEmployee.name;
      query.$or = [
        { assignedTo: employeeName },
        { 'stages.assignedTo': employeeName }
      ];
    }

    const projects = await Project.find(query).sort({ startDate: 1 });

    return NextResponse.json(projects);
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
    let { name, description, url, startDate, endDate, timeframeType, color, status, estimatedHours, assignedTo, stages } = body;

    // Sanitize string inputs
    name = sanitizeString(name, 200);
    description = description ? sanitizeString(description, 2000) : undefined;
    url = url ? sanitizeString(url, 500) : undefined;
    assignedTo = assignedTo ? sanitizeString(assignedTo, 100) : undefined;

    if (!name || !startDate || !endDate || !timeframeType) {
      return NextResponse.json(
        { error: 'Name, startDate, endDate, and timeframeType are required' },
        { status: 400 }
      );
    }

    // Validate timeframeType
    const validTimeframeTypes = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
    if (!validTimeframeTypes.includes(timeframeType)) {
      return NextResponse.json({ error: 'Invalid timeframeType' }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['planning', 'active', 'in-review', 'completed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }
    if (start > end) {
      return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 });
    }

    const projectData: any = {
      name,
      description,
      url,
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

    if (stages && Array.isArray(stages)) {
      projectData.stages = stages.map((stage: any) => ({
        ...stage,
        startDate: new Date(stage.startDate),
        endDate: new Date(stage.endDate),
      }));
    }

    const project = await Project.create(projectData);

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
