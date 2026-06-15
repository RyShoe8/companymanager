import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import type { IUser } from '@/lib/models/User';

export async function requireAdminUser(): Promise<
  { user: IUser; error: null } | { user: null; error: NextResponse }
> {
  const session = await getSession();
  if (!session?.userId) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  await connectDB();
  const user = await User.findById(session.userId);
  if (!user?.isAdmin) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }),
    };
  }

  return { user, error: null };
}
