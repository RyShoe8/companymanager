import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Employee from '@/lib/models/Employee';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();

    // Get user's organizationId
    const User = (await import('@/lib/models/User')).default;
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const employees = await Employee.find({ organizationId: user.organizationId }).sort({ name: 1 });

    return NextResponse.json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const { name, role, jobTitle, weeklyHours, employeeType, email } = body;

    if (!name || !role || weeklyHours === undefined) {
      return NextResponse.json({ error: 'Name, role, and weeklyHours are required' }, { status: 400 });
    }

    if (role !== 'Administrator' && role !== 'User') {
      return NextResponse.json({ error: 'Role must be Administrator or User' }, { status: 400 });
    }

    await connectDB();

    // Get user's organizationId and check if user is Administrator
    const User = (await import('@/lib/models/User')).default;
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if current user is an Administrator
    const currentUserEmployee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    if (!currentUserEmployee || currentUserEmployee.role !== 'Administrator') {
      return NextResponse.json({ error: 'Only Administrators can create employees' }, { status: 403 });
    }

    const employee = await Employee.create({
      name,
      role,
      jobTitle: jobTitle || undefined,
      weeklyHours: parseFloat(weeklyHours),
      employeeType: employeeType || 'full-time',
      email: email || undefined,
      organizationId: user.organizationId,
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error('Create employee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
