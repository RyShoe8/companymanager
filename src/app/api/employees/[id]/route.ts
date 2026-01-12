import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Employee from '@/lib/models/Employee';
import { requireAuth } from '@/lib/auth/middleware';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    // Get user's organizationId
    const User = (await import('@/lib/models/User')).default;
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const employee = await Employee.findOne({ _id: id, organizationId: user.organizationId });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error('Get employee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const { name, role, jobTitle, weeklyHours, employeeType, email } = body;

    await connectDB();
    const { id } = await params;

    // Get user's organizationId and check if user is Administrator
    const User = (await import('@/lib/models/User')).default;
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if current user is an Administrator
    const currentUserEmployee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    if (!currentUserEmployee || currentUserEmployee.role !== 'Administrator') {
      return NextResponse.json({ error: 'Only Administrators can edit employees' }, { status: 403 });
    }

    const employee = await Employee.findOne({ _id: id, organizationId: user.organizationId });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (name !== undefined) employee.name = name;
    if (role !== undefined) employee.role = role;
    if (jobTitle !== undefined) employee.jobTitle = jobTitle;
    if (weeklyHours !== undefined) employee.weeklyHours = parseFloat(weeklyHours);
    if (employeeType !== undefined) employee.employeeType = employeeType;
    if (email !== undefined) employee.email = email;

    await employee.save();

    return NextResponse.json(employee);
  } catch (error) {
    console.error('Update employee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    // Get user's organizationId and check if user is Administrator
    const User = (await import('@/lib/models/User')).default;
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if current user is an Administrator
    const currentUserEmployee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    if (!currentUserEmployee || currentUserEmployee.role !== 'Administrator') {
      return NextResponse.json({ error: 'Only Administrators can delete employees' }, { status: 403 });
    }

    const employee = await Employee.findOneAndDelete({ _id: id, organizationId: user.organizationId });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
