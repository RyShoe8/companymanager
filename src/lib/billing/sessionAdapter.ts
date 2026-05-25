import { NextResponse } from 'next/server';
import type { BillingSession } from 'billing-engine';
import { getSession } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import Organization from '@/lib/models/Organization';

export async function getBillingSession(): Promise<BillingSession | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  await connectDB();
  const user = await User.findById(session.userId);
  if (!user) return null;

  const org = await Organization.findOne({ userId: user.organizationId });
  const isOwner = user._id.toString() === user.organizationId;

  return {
    user: {
      id: user._id.toString(),
      email: user.email,
      organizationId: org?._id.toString(),
      role: isOwner ? 'owner' : 'member',
    },
  };
}

/** Platform admin gate for billing-engine admin routes. */
export async function requirePlatformAdminApi(): Promise<NextResponse | null> {
  const billingSession = await getBillingSession();
  if (!billingSession?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectDB();
  const user = await User.findById(billingSession.user.id);
  if (!user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
