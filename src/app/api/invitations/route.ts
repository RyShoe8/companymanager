import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Invitation from '@/lib/models/Invitation';
import Employee from '@/lib/models/Employee';
import User from '@/lib/models/User';
import { requireAuth } from '@/lib/auth/middleware';
import { generateInvitationToken } from '@/lib/utils/invitation';
import { sendEmployeeInvitationEmail } from '@/lib/services/employeeInvitation';

/**
 * GET /api/invitations - Get all invitations for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const invitations = await Invitation.find({ organizationId: user.organizationId })
      .sort({ createdAt: -1 })
      .populate('invitedBy', 'name email');

    return NextResponse.json(invitations);
  } catch (error) {
    // Get invitations error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/invitations - Create a new invitation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const { email, role, jobTitle, team, weeklyHours, employeeType, name } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    await connectDB();

    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Check if current user is an Administrator
    const currentUserEmployee = await Employee.findOne({
      userId: session.userId,
      organizationId: user.organizationId,
    });
    if (!currentUserEmployee || currentUserEmployee.role !== 'Administrator') {
      return NextResponse.json(
        { error: 'Unauthorized: Only administrators can create invitations' },
        { status: 403 }
      );
    }

    // Check if user already exists with this email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    // Check if there's already a pending invitation for this email in this organization
    const existingInvitation = await Invitation.findOne({
      email: email.toLowerCase(),
      organizationId: user.organizationId,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'A pending invitation already exists for this email' },
        { status: 400 }
      );
    }

    // Generate token and expiration (7 days from now)
    const token = generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create employee record first (without userId)
    const employee = await Employee.create({
      name: name || email.split('@')[0],
      role: role || 'User',
      jobTitle: jobTitle || undefined,
      team: team || undefined,
      weeklyHours: weeklyHours || 40,
      employeeType: employeeType || 'full-time',
      email: email.toLowerCase(),
      organizationId: user.organizationId,
    });

    // Create invitation
    const invitation = await Invitation.create({
      email: email.toLowerCase(),
      token,
      organizationId: user.organizationId,
      employeeId: employee._id,
      role: role || 'User',
      jobTitle: jobTitle || undefined,
      team: team || undefined,
      weeklyHours: weeklyHours || 40,
      employeeType: employeeType || 'full-time',
      expiresAt,
      status: 'pending',
      invitedBy: session.userId,
    });

    const emailResult = await sendEmployeeInvitationEmail({
      invitation,
      employee,
      inviterUser: user,
    });

    return NextResponse.json(
      { ...invitation.toObject(), emailSent: emailResult.emailSent, emailError: emailResult.emailError },
      { status: 201 }
    );
  } catch (error) {
    // Create invitation error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
