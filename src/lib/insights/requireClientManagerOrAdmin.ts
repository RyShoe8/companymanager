import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import { requireAuth } from '@/lib/auth/middleware';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import Client from '@/lib/models/Client';

export async function requireClientManagerOrAdmin(
  request: NextRequest,
  clientId: string
): Promise<
  | { error: NextResponse; client: null; employee: null }
  | { error: null; client: Awaited<ReturnType<typeof Client.findOne>>; employee: Awaited<ReturnType<typeof Employee.findOne>> }
> {
  const session = await requireAuth(request);
  if (session instanceof NextResponse) {
    return { error: session, client: null, employee: null };
  }

  await connectDB();

  const user = await User.findById(session.userId);
  if (!user?.organizationId) {
    return {
      error: NextResponse.json({ error: 'User or organization not found' }, { status: 404 }),
      client: null,
      employee: null,
    };
  }

  const employee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
  const isManagerOrAdmin =
    employee && (employee.role === 'Manager' || employee.role === 'Administrator');

  if (!isManagerOrAdmin) {
    return {
      error: NextResponse.json({ error: 'Forbidden - Manager or Administrator required' }, { status: 403 }),
      client: null,
      employee: null,
    };
  }

  if (!Types.ObjectId.isValid(clientId)) {
    return {
      error: NextResponse.json({ error: 'Invalid client id' }, { status: 400 }),
      client: null,
      employee: null,
    };
  }

  const client = await Client.findOne({ _id: clientId, organizationId: user.organizationId });
  if (!client) {
    return {
      error: NextResponse.json({ error: 'Client not found' }, { status: 404 }),
      client: null,
      employee: null,
    };
  }

  return { error: null, client, employee };
}
