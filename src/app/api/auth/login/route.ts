import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import { createSession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    await connectDB();

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Backward compatibility: Set organizationId if missing (for existing users)
    if (!user.organizationId) {
      user.organizationId = user._id.toString();
      await user.save();

      // Create admin employee record if it doesn't exist
      const existingEmployee = await Employee.findOne({ userId: user._id });
      if (!existingEmployee) {
        await Employee.create({
          name: user.name || user.email.split('@')[0],
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

    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
