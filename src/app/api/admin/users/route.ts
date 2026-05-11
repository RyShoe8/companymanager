import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import Organization from '@/lib/models/Organization';

/**
 * Get all users (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById(session.userId);
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Get all users with their organization info
    const users = await User.find({}).sort({ createdAt: -1 });
    const usersWithOrg = await Promise.all(
      users.map(async (u) => {
        let organizationName = 'N/A';
        let organizationDomain = null;

        // Try to find organization by userId (user is org admin)
        const userOrg = await Organization.findOne({ userId: u._id });
        if (userOrg) {
          organizationName = userOrg.name;
          organizationDomain = userOrg.domain || null;
        } else if (u.organizationId) {
          // Fallback: try to find org by organizationId
          const org = await Organization.findOne({ userId: u.organizationId });
          if (org) {
            organizationName = org.name;
            organizationDomain = org.domain || null;
          }
        }

        return {
          id: u._id.toString(),
          email: u.email,
          name: u.name || 'N/A',
          organizationId: u.organizationId ? String(u.organizationId) : 'unknown',
          organizationName,
          organizationDomain,
          createdAt: u.createdAt,
          isAdmin: u.isAdmin || false,
        };
      })
    );

    const totalUsers = users.length;

    return NextResponse.json({
      totalUsers,
      users: usersWithOrg,
    });
  } catch (error) {
    // Admin get users error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
