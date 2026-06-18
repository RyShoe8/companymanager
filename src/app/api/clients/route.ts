import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Client from '@/lib/models/Client';
import { requireAuth } from '@/lib/auth/middleware';
import { applyClientUpdates, sanitizeClientForResponse } from '@/lib/clients/clientApiHelpers';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    const User = (await import('@/lib/models/User')).default;
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const clients = await Client.find({ organizationId: user.organizationId }).sort({ name: 1 }).lean();

    const Employee = (await import('@/lib/models/Employee')).default;
    const employee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    const isManagerOrAdmin = employee?.role === 'Administrator' || employee?.role === 'Manager';

    const sanitized = clients.map((c) =>
      sanitizeClientForResponse(c as object, isManagerOrAdmin)
    );

    return NextResponse.json(sanitized);
  } catch (error) {
    console.error('Failed to get clients:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    const User = (await import('@/lib/models/User')).default;
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const Employee = (await import('@/lib/models/Employee')).default;
    const currentUserEmployee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    if (currentUserEmployee?.role !== 'Administrator' && currentUserEmployee?.role !== 'Manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    
    if (!body.name) {
      return NextResponse.json({ error: 'Client name is required' }, { status: 400 });
    }

    const newClient = await Client.create({
      organizationId: user.organizationId,
      name: body.name,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      domain: body.domain,
      logo: body.logo,
      color: body.color || '#3b82f6',
      status: body.status || 'active',
      userIds: [],
    });

    const Project = (await import('@/lib/models/Project')).default;
    await Project.create({
      userId: session.userId,
      name: body.name,
      projectType: 'client-admin',
      clientId: newClient._id,
      status: 'planning',
      category: 'generic',
      color: body.color || '#3b82f6',
    });

    return NextResponse.json(newClient, { status: 201 });
  } catch (error) {
    console.error('Failed to create client:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    const User = (await import('@/lib/models/User')).default;
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const Employee = (await import('@/lib/models/Employee')).default;
    const currentUserEmployee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    if (currentUserEmployee?.role !== 'Administrator' && currentUserEmployee?.role !== 'Manager') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    if (!body._id) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    const client = await Client.findOne({ _id: body._id, organizationId: user.organizationId });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const result = applyClientUpdates(client, body, true);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await client.save();
    const lean = client.toObject();
    return NextResponse.json(sanitizeClientForResponse(lean, true));
  } catch (error) {
    console.error('Failed to update client:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
