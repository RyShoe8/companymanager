import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      // Return 200 with null instead of 401 for public pages
      // This prevents unnecessary 401 errors in logs when Navigation component
      // calls this endpoint on public pages where users aren't logged in
      return NextResponse.json(null, { status: 200 });
    }

    await connectDB();
    const user = await User.findById(session.userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Auto-complete organization setup for existing users who have an organization
    // This fixes the redirect loop for users created before organization setup was required
    if (!user.organizationSetupComplete && user.organizationId) {
      const Organization = (await import('@/lib/models/Organization')).default;
      const organization = await Organization.findOne({ userId: user._id });
      if (organization) {
        user.organizationSetupComplete = true;
        await user.save();
      }
    }

    return NextResponse.json({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      profilePicture: user.profilePicture,
      organizationSetupComplete: user.organizationSetupComplete,
      isAdmin: user.isAdmin,
    });
  } catch (error) {
    // Get user error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
