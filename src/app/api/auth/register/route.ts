import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import Invitation from '@/lib/models/Invitation';
import { createSession } from '@/lib/auth/session';
import { isValidEmail, sanitizeString, isValidObjectId } from '@/lib/utils/security';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { email, password, name, invitationToken } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Sanitize and validate inputs
    email = sanitizeString(email, 254);
    password = password.trim();
    name = name ? sanitizeString(name, 100) : undefined;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    if (password.length > 128) {
      return NextResponse.json({ error: 'Password is too long' }, { status: 400 });
    }

    // Validate invitation token format if provided
    if (invitationToken && !isValidObjectId(invitationToken) && invitationToken.length > 100) {
      return NextResponse.json({ error: 'Invalid invitation token' }, { status: 400 });
    }

    await connectDB();

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    let organizationId: string;
    let employeeId: string | undefined;

    // If invitation token is provided, validate it and use the invitation's organization
    if (invitationToken) {
      const invitation = await Invitation.findOne({
        token: invitationToken,
        status: 'pending',
      });

      if (!invitation) {
        return NextResponse.json(
          { error: 'Invalid or expired invitation token' },
          { status: 400 }
        );
      }

      // Check if invitation has expired
      if (new Date() > invitation.expiresAt) {
        invitation.status = 'expired';
        await invitation.save();
        return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
      }

      // Verify email matches invitation email
      if (invitation.email.toLowerCase() !== email.toLowerCase()) {
        return NextResponse.json(
          { error: 'Email does not match the invitation' },
          { status: 400 }
        );
      }

      // Use organization from invitation
      organizationId = invitation.organizationId;
      employeeId = invitation.employeeId?.toString();

      // Mark invitation as accepted
      invitation.status = 'accepted';
      await invitation.save();
    } else {
      // No invitation - create new organization (user is admin)
      organizationId = `temp-${Date.now()}`;
    }

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      organizationId,
      organizationSetupComplete: !!invitationToken, // If invited, org is already set up
    });

    // If no invitation, set organizationId to user's own ID (they are the organization admin)
    if (!invitationToken) {
      user.organizationId = user._id.toString();
      await user.save();
      organizationId = user._id.toString();
    }

    // Handle employee record
    if (invitationToken && employeeId) {
      // Link existing employee record to the new user
      const employee = await Employee.findById(employeeId);
      if (employee) {
        employee.userId = user._id;
        // Update name if provided
        if (name) {
          employee.name = name;
        }
        await employee.save();
      }
    } else {
      // Create admin employee record for the user (new organization)
      await Employee.create({
        name: name || email.split('@')[0],
        role: 'Administrator',
        weeklyHours: 0,
        employeeType: 'full-time',
        userId: user._id,
        organizationId: user._id.toString(),
      });
    }

    // Create session
    await createSession(user._id.toString(), user.email);

    return NextResponse.json(
      {
        message: invitationToken ? 'Account created successfully. Welcome to the team!' : 'User created successfully',
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          organizationSetupComplete: user.organizationSetupComplete,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
