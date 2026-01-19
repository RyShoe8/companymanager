import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';

/**
 * One-time setup script to:
 * 1. Set admin users
 * 2. Fix organizationSetupComplete for existing users
 * 
 * This can be called once manually or run as a migration script
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const adminEmails = ['ryanschumacher@themediashop.co', 'kellymcguire@themediashop.co'];
    
    // Set admin users
    const adminUsers = await User.updateMany(
      { email: { $in: adminEmails.map(e => e.toLowerCase()) } },
      { $set: { isAdmin: true } }
    );

    // Fix organizationSetupComplete for existing users who have organizations
    // For users created before organization setup was required
    const Organization = (await import('@/lib/models/Organization')).default;
    const allUsers = await User.find({ organizationSetupComplete: { $ne: true } });
    
    let fixedCount = 0;
    for (const user of allUsers) {
      // Check if user has an organization
      const org = await Organization.findOne({ userId: user._id });
      if (org || user.organizationId) {
        user.organizationSetupComplete = true;
        await user.save();
        fixedCount++;
      }
    }

    return NextResponse.json({
      message: 'Setup complete',
      adminsSet: adminUsers.modifiedCount,
      usersFixed: fixedCount,
    });
  } catch (error) {
    // Admin setup error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
