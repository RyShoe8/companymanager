import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import Project from '@/lib/models/Project';
import Operation from '@/lib/models/Operation';
import Asset from '@/lib/models/Asset';
import Invitation from '@/lib/models/Invitation';
import Organization from '@/lib/models/Organization';

/**
 * Update a user's admin status (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const adminUser = await User.findById(session.userId);
    if (!adminUser || !adminUser.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { id: userId } = await params;
    const body = await request.json();
    const { isAdmin } = body;

    // Prevent changing your own admin status
    if (userId === session.userId) {
      return NextResponse.json({ error: 'Cannot change your own admin status' }, { status: 400 });
    }

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    user.isAdmin = isAdmin === true;
    await user.save();

    return NextResponse.json({ 
      message: `User ${isAdmin ? 'promoted to' : 'removed from'} admin successfully`,
      user: {
        id: user._id.toString(),
        email: user.email,
        isAdmin: user.isAdmin,
      }
    });
  } catch (error) {
    console.error('Admin update user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Delete a user (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const adminUser = await User.findById(session.userId);
    if (!adminUser || !adminUser.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { id: userId } = await params;

    // Prevent deleting yourself
    if (userId === session.userId) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent deleting other admins
    if (user.isAdmin) {
      return NextResponse.json({ error: 'Cannot delete admin users' }, { status: 400 });
    }

    // Delete related data
    await Promise.all([
      Employee.deleteMany({ userId: user._id }),
      Project.deleteMany({ userId: user._id }),
      Operation.deleteMany({ userId: user._id }),
      Asset.deleteMany({ userId: user._id }),
      Invitation.deleteMany({ organizationId: user.organizationId }),
    ]);

    // Delete organization if user is the admin
    if (user._id.toString() === user.organizationId) {
      await Organization.deleteOne({ userId: user._id });
    }

    // Delete user
    await User.deleteOne({ _id: user._id });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
