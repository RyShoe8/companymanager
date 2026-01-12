import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import { createSession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    await connectDB();

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with temporary organizationId (will be updated after creation)
    // We'll use a placeholder first, then update it
    const tempOrgId = `temp-${Date.now()}`;
    const user = await User.create({
      email,
      password: hashedPassword,
      name,
      organizationId: tempOrgId,
    });

    // Set organizationId to user's own ID (they are the organization admin)
    user.organizationId = user._id.toString();
    await user.save();

    // Create admin employee record for the user
    await Employee.create({
      name: name || email.split('@')[0],
      role: 'Administrator',
      weeklyHours: 40,
      employeeType: 'full-time',
      userId: user._id,
      organizationId: user._id.toString(),
    });

    // Create session
    await createSession(user._id.toString(), user.email);

    return NextResponse.json(
      {
        message: 'User created successfully',
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
