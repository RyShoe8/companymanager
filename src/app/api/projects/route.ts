import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Don't filter by timeframeType - projects should appear based on their date range
    // timeframeType is just metadata about the view they were created in
    const query: any = { userId: session.userId };
    if (status) {
      query.status = status;
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

    const body = await request.json();
    const { name, description, url, startDate, endDate, timeframeType, color, status, estimatedHours, assignedTo, stages } = body;

    if (!name || !startDate || !endDate || !timeframeType) {
      return NextResponse.json(
        { error: 'Name, startDate, endDate, and timeframeType are required' },
        { status: 400 }
      );
    }

    await connectDB();

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
