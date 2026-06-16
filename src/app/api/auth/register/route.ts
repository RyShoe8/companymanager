import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import Invitation from '@/lib/models/Invitation';
import { createSession } from '@/lib/auth/session';
import { enforceRateLimit, rateLimitKey } from '@/lib/security/rateLimit';
import { isValidEmail } from '@/lib/utils/security';
import {
  syncRegisteredUserToBrevoInBackground,
  syncUserToBrevoInBackground,
} from '@/lib/services/brevoContactSync';

export async function POST(request: NextRequest) {
  try {
    const limit = enforceRateLimit({
      key: rateLimitKey(request, 'auth-register'),
      limit: 6,
      windowMs: 60_000,
    });
    if (limit) return limit;

    const body = await request.json();
    const { email, password, name, invitationToken } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    if (!isValidEmail(String(email))) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    if (String(password).length < 8 || String(password).length > 128) {
      return NextResponse.json(
        { error: 'Password must be between 8 and 128 characters' },
        { status: 400 }
      );
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

      // Mark invitation as accepted and delete it (no longer needed)
      invitation.status = 'accepted';
      await invitation.save();
      await Invitation.findByIdAndDelete(invitation._id);
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
      let employee = await Employee.findById(employeeId);
      
      // If not found by ID, try to find by email and organizationId
      if (!employee) {
        employee = await Employee.findOne({
          email: email.toLowerCase(),
          organizationId: organizationId,
          userId: { $exists: false },
        });
      }
      
      // If still not found, try case-insensitive email search as fallback
      if (!employee) {
        employee = await Employee.findOne({
          email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          organizationId: organizationId,
          userId: { $exists: false },
        });
      }
      
      if (employee) {
        // Check if employee already has a userId (prevent duplicates)
        if (employee.userId) {
          return NextResponse.json(
            { error: 'This invitation has already been accepted' },
            { status: 400 }
          );
        }
        employee.userId = user._id;
        // Update name if provided
        if (name) {
          employee.name = name;
        }
        // Ensure organizationId matches (in case of any mismatch)
        if (employee.organizationId !== organizationId) {
          employee.organizationId = organizationId;
        }
        // Ensure email is set
        if (!employee.email) {
          employee.email = email.toLowerCase();
        }
        await employee.save();
      }
      // If employee still not found, that's okay - they'll be created below if needed
    } else if (!invitationToken) {
      // Create admin employee record for the user (new organization)
      // Check if employee already exists
      const existingEmployee = await Employee.findOne({
        email: email.toLowerCase(),
        organizationId: user._id.toString(),
      });
      if (!existingEmployee) {
        await Employee.create({
          name: name || email.split('@')[0],
          role: 'Administrator',
          weeklyHours: 40,
          employeeType: 'full-time',
          userId: user._id,
          organizationId: user._id.toString(),
        });
      }
    }

    // Create session
    await createSession(user._id.toString(), user.email);

    if (invitationToken) {
      syncRegisteredUserToBrevoInBackground({
        email: user.email,
        name: user.name,
        organizationId,
        userId: user._id.toString(),
      });
    } else {
      syncUserToBrevoInBackground({
        email: user.email,
        name: user.name,
        organizationId,
        role: 'Administrator',
      });
    }

    return NextResponse.json(
      {
        message: invitationToken ? 'Account created successfully. Welcome to the team!' : 'User created successfully',
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // Registration error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
