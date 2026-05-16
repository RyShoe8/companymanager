import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Employee from '@/lib/models/Employee';
import User from '@/lib/models/User';
import { requireAuth } from '@/lib/auth/middleware';
import { inviteEmployeeByEmail } from '@/lib/services/employeeInvitation';
import { isValidObjectId } from '@/lib/utils/security';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid employee ID' }, { status: 400 });
    }

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentUserEmployee = await Employee.findOne({
      userId: session.userId,
      organizationId: user.organizationId,
    });
    if (!currentUserEmployee || currentUserEmployee.role !== 'Administrator') {
      return NextResponse.json(
        { error: 'Only Administrators can resend invitations' },
        { status: 403 }
      );
    }

    const employee = await Employee.findOne({ _id: id, organizationId: user.organizationId });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (!employee.email) {
      return NextResponse.json(
        { error: 'Employee has no email address for invitation' },
        { status: 400 }
      );
    }

    if (employee.userId) {
      return NextResponse.json(
        { error: 'Employee already has a linked user account' },
        { status: 400 }
      );
    }

    const existingUser = await User.findOne({ email: employee.email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    const result = await inviteEmployeeByEmail({
      employee,
      inviterUser: user,
      inviterUserId: session.userId,
    });

    return NextResponse.json({
      invitation: result.invitation,
      emailSent: result.emailSent,
      emailError: result.emailError,
    });
  } catch (error) {
    console.error('Error resending employee invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
