import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import WorkspaceNotificationPreference from '@/lib/models/WorkspaceNotificationPreference';
import { requireAuth } from '@/lib/auth/middleware';
import {
  isWorkspaceDigestInterval,
  type WorkspaceDigestInterval,
} from '@/lib/workspace/notificationTypes';

async function getSessionEmployee(session: { userId: string }) {
  const user = await User.findById(session.userId);
  if (!user?.organizationId) {
    return { error: NextResponse.json({ error: 'User or organization not found' }, { status: 404 }) };
  }

  const employee = await Employee.findOne({
    userId: session.userId,
    organizationId: user.organizationId,
  });
  if (!employee) {
    return { error: NextResponse.json({ error: 'Employee profile not found' }, { status: 404 }) };
  }

  return { user, employee };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const result = await getSessionEmployee(session);
    if ('error' in result) return result.error;

    const { user, employee } = result;
    const pref = await WorkspaceNotificationPreference.findOne({ userId: session.userId }).lean();

    return NextResponse.json({
      interval: (pref?.interval as WorkspaceDigestInterval | undefined) ?? 'off',
      lastDigestSentAt: pref?.lastDigestSentAt ?? null,
      employeeId: employee._id.toString(),
      organizationId: user.organizationId,
    });
  } catch (error) {
    console.error('GET workspace notification-preferences error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const { interval } = body as { interval?: unknown };
    if (!isWorkspaceDigestInterval(interval)) {
      return NextResponse.json({ error: 'Invalid interval' }, { status: 400 });
    }

    await connectDB();
    const result = await getSessionEmployee(session);
    if ('error' in result) return result.error;

    const { user, employee } = result;
    const pref = await WorkspaceNotificationPreference.findOneAndUpdate(
      { userId: session.userId },
      {
        userId: session.userId,
        employeeId: employee._id,
        organizationId: user.organizationId,
        interval,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({
      interval: pref.interval,
      lastDigestSentAt: pref.lastDigestSentAt ?? null,
    });
  } catch (error) {
    console.error('PATCH workspace notification-preferences error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
