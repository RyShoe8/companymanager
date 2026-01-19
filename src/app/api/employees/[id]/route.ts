import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Employee from '@/lib/models/Employee';
import { requireAuth } from '@/lib/auth/middleware';
import { deleteBrevoContact } from '@/lib/services/email';
import { isValidObjectId, sanitizeString, isValidEmail } from '@/lib/utils/security';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const { id } = await params;

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid employee ID' }, { status: 400 });
    }

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
    // Get employee error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    let { name, role, jobTitle, team, weeklyHours, employeeType, email } = body;

    await connectDB();
    const { id } = await params;

    // Validate ObjectId format
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid employee ID' }, { status: 400 });
    }

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

    // Store old name before updating (needed to update assignments)
    const oldName = employee.name;
    let newName: string | undefined = undefined;

    // Validate and sanitize inputs
    if (name !== undefined) {
      name = sanitizeString(name, 100);
      if (!name) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      }
      newName = name;
      employee.name = name;
    }
    if (role !== undefined) {
      const validRoles = ['Administrator', 'Manager', 'User'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      employee.role = role;
    }
    if (jobTitle !== undefined) employee.jobTitle = sanitizeString(jobTitle, 100);
    if (team !== undefined) {
      const validTeams = ['Development', 'Marketing', 'Testing'];
      if (team && !validTeams.includes(team)) {
        return NextResponse.json({ error: 'Invalid team' }, { status: 400 });
      }
      employee.team = team || undefined;
    }
    if (weeklyHours !== undefined) {
      const hours = parseFloat(weeklyHours);
      if (isNaN(hours) || hours < 0 || hours > 168) {
        return NextResponse.json({ error: 'Invalid weekly hours (0-168)' }, { status: 400 });
      }
      employee.weeklyHours = hours;
    }
    if (employeeType !== undefined) {
      const validTypes = ['full-time', 'part-time', 'contractor'];
      if (!validTypes.includes(employeeType)) {
        return NextResponse.json({ error: 'Invalid employee type' }, { status: 400 });
      }
      employee.employeeType = employeeType;
    }
    if (email !== undefined) {
      email = sanitizeString(email, 254);
      if (email && !isValidEmail(email)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
      }
      employee.email = email || undefined;
    }

    await employee.save();

    // If name changed, update all assignments in projects and operations
    // Now using employeeId, so we can precisely update only THIS employee's assignments
    if (newName && newName !== oldName) {
      const Project = (await import('@/lib/models/Project')).default;
      const Operation = (await import('@/lib/models/Operation')).default;
      const employeeId = employee._id;

      // Update project assignments using employeeId (precise - only this employee)
      await Project.updateMany(
        { assignedToEmployeeId: employeeId },
        { $set: { assignedTo: newName } }
      );

      // Update project task assignments using employeeId (precise - only this employee)
      await Project.updateMany(
        { 'tasks.assignedToEmployeeId': employeeId },
        { $set: { 'tasks.$[task].assignedTo': newName } },
        { arrayFilters: [{ 'task.assignedToEmployeeId': employeeId }] }
      );

      // Update operation assignments using employeeId (precise - only this employee)
      await Operation.updateMany(
        { assignedToEmployeeId: employeeId },
        { $set: { assignedTo: newName } }
      );
      
      // Also update legacy name-based assignments for backward compatibility
      // Get all user IDs in the organization to filter properly
      const orgUserIds = await (await import('@/lib/utils/apiHelpers')).getOrganizationUserIds(session.userId, user.organizationId);
      
      // Update legacy project assignments - only for projects in the organization
      await Project.updateMany(
        { userId: { $in: orgUserIds }, assignedTo: oldName, assignedToEmployeeId: { $exists: false } },
        { $set: { assignedTo: newName } }
      );

      // Update legacy project task assignments - only for projects in the organization
      await Project.updateMany(
        { userId: { $in: orgUserIds }, 'tasks.assignedTo': oldName, 'tasks.assignedToEmployeeId': { $exists: false } },
        { $set: { 'tasks.$[task].assignedTo': newName } },
        { arrayFilters: [{ 'task.assignedTo': oldName }] }
      );

      // Update legacy operation assignments - only for operations in the organization
      await Operation.updateMany(
        { userId: { $in: orgUserIds }, assignedTo: oldName, assignedToEmployeeId: { $exists: false } },
        { $set: { assignedTo: newName } }
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    // Update employee error
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

    // Find the employee first to get their name for cleanup
    const employee = await Employee.findOne({ _id: id, organizationId: user.organizationId });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const employeeName = employee.name;
    const employeeEmail = employee.email;

    // Delete associated invitations
    const Invitation = (await import('@/lib/models/Invitation')).default;
    await Invitation.deleteMany({
      $or: [
        { employeeId: id },
        ...(employeeEmail ? [{ email: employeeEmail.toLowerCase() }] : []),
      ],
      organizationId: user.organizationId,
    });

    // Delete the employee from the database
    await Employee.deleteOne({ _id: id, organizationId: user.organizationId });

    // Remove from Brevo if email exists
    if (employeeEmail) {
      try {
        await deleteBrevoContact(employeeEmail);
      } catch (brevoError) {
        // Error removing contact from Brevo
        // Don't fail the request if Brevo fails
      }
    }

    // Clean up assignments in projects and operations using employeeId
    const Project = (await import('@/lib/models/Project')).default;
    const Operation = (await import('@/lib/models/Operation')).default;
    const employeeId = id;

    // Remove employee assignments from projects using employeeId
    await Project.updateMany(
      { assignedToEmployeeId: employeeId },
      { $unset: { assignedToEmployeeId: '', assignedTo: '' } }
    );

    // Remove employee assignments from project tasks using employeeId
    await Project.updateMany(
      { 'tasks.assignedToEmployeeId': employeeId },
      { $set: { 'tasks.$[task].assignedToEmployeeId': null, 'tasks.$[task].assignedTo': null } },
      { arrayFilters: [{ 'task.assignedToEmployeeId': employeeId }] }
    );

    // Remove employee assignments from operations using employeeId
    await Operation.updateMany(
      { assignedToEmployeeId: employeeId },
      { $unset: { assignedToEmployeeId: '', assignedTo: '' } }
    );
    
    // Also clean up legacy name-based assignments for backward compatibility
    await Project.updateMany(
      { userId: session.userId, assignedTo: employeeName },
      { $unset: { assignedTo: '' } }
    );

    await Project.updateMany(
      { userId: session.userId, 'tasks.assignedTo': employeeName },
      { $set: { 'tasks.$[task].assignedTo': null } },
      { arrayFilters: [{ 'task.assignedTo': employeeName }] }
    );

    await Operation.updateMany(
      { userId: session.userId, assignedTo: employeeName },
      { $unset: { assignedTo: '' } }
    );

    return NextResponse.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    // Delete employee error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
