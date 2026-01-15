import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import User from '@/lib/models/User';
import { requireAuth } from '@/lib/auth/middleware';
import { isValidObjectId, sanitizeString } from '@/lib/utils/security';

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
    const orgUsers = await User.find({ organizationId: user.organizationId });
    const orgUserIds = orgUsers.map(u => u._id);

    const project = await Project.findOne({ _id: id, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    let { name, description, url, startDate, endDate, timeframeType, color, status, estimatedHours, assignedTo, stages } = body;

    await connectDB();
    const { id } = await params;

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

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
    const orgUsers = await User.find({ organizationId: user.organizationId });
    const orgUserIds = orgUsers.map(u => u._id);

    const project = await Project.findOne({ _id: id, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // If user is not a Manager or Administrator, only allow status change from active to in-review
    if (!isManagerOrAdmin) {
      if (currentUserEmployee?.role !== 'User') {
        return NextResponse.json({ error: 'Only Managers, Administrators, and Users can update projects' }, { status: 403 });
      }
      
      // Regular users can only change status from active to in-review
      if (status !== undefined && status !== project.status) {
        if (project.status !== 'active' || status !== 'in-review') {
          return NextResponse.json({ error: 'Users can only change status from active to in-review' }, { status: 403 });
        }
      }
      
      // Regular users cannot change other fields
      if (name !== undefined || description !== undefined || url !== undefined || 
          startDate !== undefined || endDate !== undefined || timeframeType !== undefined || 
          color !== undefined || estimatedHours !== undefined || assignedTo !== undefined || 
          stages !== undefined) {
        return NextResponse.json({ error: 'Users can only change project status' }, { status: 403 });
      }
    }

    // Sanitize string inputs
    if (name !== undefined) project.name = sanitizeString(name, 200);
    if (description !== undefined) project.description = sanitizeString(description, 2000);
    if (url !== undefined) project.url = sanitizeString(url, 500);
    if (startDate !== undefined) project.startDate = new Date(startDate);
    if (endDate !== undefined) project.endDate = new Date(endDate);
    if (timeframeType !== undefined) project.timeframeType = timeframeType;
    if (color !== undefined) project.color = color;
    if (status !== undefined) project.status = status;
    if (estimatedHours !== undefined) {
      project.estimatedHours = estimatedHours === null || estimatedHours === '' ? undefined : estimatedHours;
    }
    if (assignedTo !== undefined) {
      project.assignedTo = assignedTo === null || assignedTo === '' ? undefined : assignedTo;
    }
    if (stages !== undefined) {
      if (Array.isArray(stages)) {
        project.stages = stages.map((stage: any) => ({
          name: stage.name,
          description: stage.description || undefined,
          startDate: new Date(stage.startDate),
          endDate: new Date(stage.endDate),
          estimatedHours: stage.estimatedHours || undefined,
          assignedTo: stage.assignedTo || undefined,
          status: stage.status || 'planning',
        }));
      } else {
        project.stages = [];
      }
    }

    await project.save();

    return NextResponse.json(project);
  } catch (error) {
    console.error('Update project error:', error);
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
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    // Get user's organizationId
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Find all users in the same organization
    const orgUsers = await User.find({ organizationId: user.organizationId });
    const orgUserIds = orgUsers.map(u => u._id);

    const project = await Project.findOneAndDelete({ _id: id, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
