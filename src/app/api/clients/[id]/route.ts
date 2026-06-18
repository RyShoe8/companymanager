import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Client from '@/lib/models/Client';
import Project from '@/lib/models/Project';
import Asset from '@/lib/models/Asset';
import { requireAuth } from '@/lib/auth/middleware';
import {
  applyClientUpdates,
  migrateHubOpsToClient,
  sanitizeClientForResponse,
} from '@/lib/clients/clientApiHelpers';

async function getSessionContext(request: NextRequest) {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) return session;

  await connectDB();

  const User = (await import('@/lib/models/User')).default;
  const user = await User.findById(session.userId);
  if (!user || !user.organizationId) {
    return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
  }

  const Employee = (await import('@/lib/models/Employee')).default;
  const employee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
  const isManagerOrAdmin = employee?.role === 'Administrator' || employee?.role === 'Manager';

  return { session, user, isManagerOrAdmin };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getSessionContext(request);
    if (ctx instanceof NextResponse) return ctx;

    const { id } = await params;
    const client = await Client.findOne({ _id: id, organizationId: ctx.user.organizationId });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const hubProject = await Project.findOne({
      clientId: id,
      projectType: 'client-admin',
    }).lean();

    if (migrateHubOpsToClient(client, hubProject as Parameters<typeof migrateHubOpsToClient>[1])) {
      await client.save();
    }

    const lean = client.toObject();
    return NextResponse.json(sanitizeClientForResponse(lean, ctx.isManagerOrAdmin));
  } catch (error) {
    console.error('Failed to get client:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getSessionContext(request);
    if (ctx instanceof NextResponse) return ctx;

    if (!ctx.isManagerOrAdmin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { id } = await params;

    const client = await Client.findOne({ _id: id, organizationId: ctx.user.organizationId });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const result = applyClientUpdates(client, body, ctx.isManagerOrAdmin);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    await client.save();
    const lean = client.toObject();
    return NextResponse.json(sanitizeClientForResponse(lean, ctx.isManagerOrAdmin));
  } catch (error) {
    console.error('Failed to update client:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getSessionContext(request);
    if (ctx instanceof NextResponse) return ctx;

    if (!ctx.isManagerOrAdmin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;
    const client = await Client.findOneAndDelete({ _id: id, organizationId: ctx.user.organizationId });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    await Project.updateMany(
      { clientId: id },
      { $unset: { clientId: 1 } }
    );

    await Asset.updateMany(
      { linkedClientId: id },
      { $unset: { linkedClientId: 1, clientAccessible: 1 } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete client:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
