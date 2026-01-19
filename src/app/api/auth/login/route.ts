import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import { createSession } from '@/lib/auth/session';
import { isValidEmail, sanitizeString } from '@/lib/utils/security';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Sanitize inputs
    email = sanitizeString(email, 254);
    password = password.trim();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Validate password length to prevent DoS
    if (password.length > 128) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Lowercase email to match database storage (User model has lowercase: true)
    email = email.toLowerCase();

    await connectDB();

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Check if user is using OAuth (no password)
    if (user.authProvider === 'google' && !user.password) {
      return NextResponse.json({ 
        error: 'This account uses Google sign-in. Please sign in with Google.' 
      }, { status: 401 });
    }

    // Verify password
    if (!user.password) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Set admin users
    const adminEmails = ['ryanschumacher@themediashop.co', 'kellymcguire@themediashop.co'];
    if (adminEmails.includes(user.email.toLowerCase()) && !user.isAdmin) {
      user.isAdmin = true;
    }

    // Backward compatibility: Set organizationId if missing (for existing users)
    if (!user.organizationId) {
      user.organizationId = user._id.toString();
    }

    // Fix organizationSetupComplete for existing users
    if (!user.organizationSetupComplete && user.organizationId) {
      const Organization = (await import('@/lib/models/Organization')).default;
      const org = await Organization.findOne({ userId: user._id });
      if (org || user._id.toString() === user.organizationId) {
        user.organizationSetupComplete = true;
      }
    }

    // Save any changes
    if (user.isModified()) {
      await user.save();
    }

    // Create admin employee record if it doesn't exist
    const existingEmployee = await Employee.findOne({ userId: user._id });
    if (!existingEmployee) {
      await Employee.create({
        name: user.name || user.email.split('@')[0],
        role: 'Administrator',
        weeklyHours: 0,
        employeeType: 'full-time',
        userId: user._id,
        organizationId: user._id.toString(),
      });
    }

    // Create session
    await createSession(user._id.toString(), user.email);

    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        organizationSetupComplete: user.organizationSetupComplete,
      },
    });
  } catch (error) {
    // Login error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
