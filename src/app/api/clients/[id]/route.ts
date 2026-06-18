import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Client from '@/lib/models/Client';
import Project from '@/lib/models/Project';
import { requireAuth } from '@/lib/auth/middleware';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    const client = await Client.findOneAndUpdate(
      { _id: id, organizationId: user.organizationId },
      { $set: body },
      { new: true }
    );

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error('Failed to update client:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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

    const client = await Client.findOneAndDelete({ _id: id, organizationId: user.organizationId });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Unlink any projects connected to this client
    await Project.updateMany(
      { clientId: id, organizationId: user.organizationId },
      { $unset: { clientId: 1 } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete client:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
