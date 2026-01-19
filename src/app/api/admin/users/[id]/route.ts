import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import Invitation from '@/lib/models/Invitation';
import { isValidObjectId } from '@/lib/utils/security';

/**
 * Update user (admin only)
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const { id } = await params;

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const user = await User.findById(session.userId);
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { isAdmin } = body;

    // Update isAdmin status using updateOne to bypass pre-save hooks
    if (typeof isAdmin === 'boolean') {
      await User.updateOne({ _id: id }, { $set: { isAdmin } });
    }

    const updatedUser = await User.findById(id);

    return NextResponse.json({
      id: updatedUser!._id.toString(),
      email: updatedUser!.email,
      name: updatedUser!.name,
      isAdmin: updatedUser!.isAdmin || false,
    });
  } catch (error) {
    // Admin update user error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Delete user (admin only)
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const { id } = await params;

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const user = await User.findById(session.userId);
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete invitations sent by or to this user
    await Invitation.deleteMany({
      $or: [
        { invitedBy: targetUser._id }, // Invitations sent by this user
        { email: targetUser.email.toLowerCase() }, // Invitations sent to this user
      ],
    });

    // Delete employees linked to this user
    await Employee.deleteMany({
      $or: [
        { userId: targetUser._id }, // Employees linked by user ID
        { email: targetUser.email.toLowerCase() }, // Employees linked by email
      ],
    });

    // Delete the user
    await User.findByIdAndDelete(id);

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    // Admin delete user error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
