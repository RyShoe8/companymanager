import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Employee from '@/lib/models/Employee';
import Invitation from '@/lib/models/Invitation';
import { requireAuth } from '@/lib/auth/middleware';
import { generateInvitationToken } from '@/lib/utils/invitation';
import { sendInvitationEmail, createBrevoContact } from '@/lib/services/email';

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

    // Return all employees (including pending invitations)
    // The EmployeeSidebar component will filter out pending invitations for utilization
    const employees = await Employee.find({ organizationId: user.organizationId }).sort({ name: 1 }).lean();

    return NextResponse.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const { name, role, jobTitle, team, weeklyHours, employeeType, email } = body;

    if (!name || !role || weeklyHours === undefined || weeklyHours === null || isNaN(parseFloat(weeklyHours))) {
      return NextResponse.json({ 
        error: 'Name, role, and weeklyHours are required. WeeklyHours must be a valid number.',
        received: { name, role, weeklyHours }
      }, { status: 400 });
    }

    if (role !== 'Administrator' && role !== 'Manager' && role !== 'User') {
      return NextResponse.json({ error: 'Role must be Administrator, Manager, or User' }, { status: 400 });
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

    // If email is provided, create an invitation instead of just an employee
    if (email) {
      // Check if user already exists with this email
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return NextResponse.json(
          { error: 'A user with this email already exists. Please invite them directly.' },
          { status: 400 }
        );
      }

      // Check if there's already a pending invitation for this email
      const existingInvitation = await Invitation.findOne({
        email: email.toLowerCase(),
        organizationId: user.organizationId,
        status: 'pending',
        expiresAt: { $gt: new Date() },
      });

      let employee;
      let invitation;

      if (existingInvitation) {
        // If invitation exists, check if employee exists
        if (existingInvitation.employeeId) {
          employee = await Employee.findById(existingInvitation.employeeId);
          if (employee) {
            // Update existing employee
            employee.name = name;
            employee.role = role;
            employee.jobTitle = jobTitle || undefined;
            employee.team = team || undefined;
            employee.weeklyHours = parseFloat(weeklyHours);
            employee.employeeType = employeeType || 'full-time';
            await employee.save();
            
            // Update existing invitation with new token and reset expiration
            invitation = existingInvitation;
            invitation.token = generateInvitationToken(); // Generate new token
            invitation.role = role;
            invitation.jobTitle = jobTitle || undefined;
            invitation.weeklyHours = parseFloat(weeklyHours);
            invitation.employeeType = employeeType || 'full-time';
            invitation.team = team || undefined;
            invitation.expiresAt = new Date();
            invitation.expiresAt.setDate(invitation.expiresAt.getDate() + 7);
            await invitation.save();
          }
        }
        
        // If employee doesn't exist, create it
        if (!employee) {
          employee = await Employee.create({
            name,
            role,
            jobTitle: jobTitle || undefined,
            team: team || undefined,
            weeklyHours: parseFloat(weeklyHours),
            employeeType: employeeType || 'full-time',
            email: email.toLowerCase(),
            organizationId: user.organizationId,
          });
          
          // Update invitation with new employee ID and new token
          invitation = existingInvitation;
          invitation.employeeId = employee._id;
          invitation.token = generateInvitationToken(); // Generate new token
          invitation.role = role;
          invitation.jobTitle = jobTitle || undefined;
          invitation.weeklyHours = parseFloat(weeklyHours);
          invitation.employeeType = employeeType || 'full-time';
          invitation.team = team || undefined;
          invitation.expiresAt = new Date();
          invitation.expiresAt.setDate(invitation.expiresAt.getDate() + 7);
          await invitation.save();
        }
      } else {
        // No existing invitation, create new employee and invitation
        employee = await Employee.create({
          name,
          role,
          jobTitle: jobTitle || undefined,
          team: team || undefined,
          weeklyHours: parseFloat(weeklyHours),
          employeeType: employeeType || 'full-time',
          email: email.toLowerCase(),
          organizationId: user.organizationId,
        });

        // Create invitation
        const token = generateInvitationToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        invitation = await Invitation.create({
          email: email.toLowerCase(),
          token,
          organizationId: user.organizationId,
          employeeId: employee._id,
          role,
          jobTitle: jobTitle || undefined,
          team: team || undefined,
          weeklyHours: parseFloat(weeklyHours),
          employeeType: employeeType || 'full-time',
          expiresAt,
          status: 'pending',
          invitedBy: session.userId,
        });
      }

      // Send invitation email (only if we have a token)
      if (invitation && invitation.token) {
        try {
          // Get organization name
          const Organization = (await import('@/lib/models/Organization')).default;
          const adminUserId = user.organizationId;
          const organization = await Organization.findOne({ userId: adminUserId });
          const organizationName = organization?.name || 'the organization';
          
          // Get base URL from request headers or environment
          const origin = request.headers.get('origin') || request.headers.get('host');
          let baseUrl: string | undefined;
          if (origin) {
            // If origin is a full URL, use it; otherwise construct from host
            baseUrl = origin.startsWith('http') ? origin : `https://${origin}`;
          }
          const { getInvitationLink } = await import('@/lib/utils/invitation');
          const invitationLink = getInvitationLink(invitation.token, baseUrl);
          await sendInvitationEmail({
            recipientEmail: email.toLowerCase(),
            recipientName: name,
            inviterName: user.name || user.email,
            organizationName: organizationName,
            invitationLink,
            role,
            expiresInDays: 7,
          });
        } catch (emailError: any) {
          // Failed to send invitation email
          // Don't fail the request if email fails - invitation is still created/updated
        }
      }

      // Add contact to Brevo
      try {
        await createBrevoContact({
          email: email.toLowerCase(),
          name,
          attributes: {
            ROLE: role,
            JOB_TITLE: jobTitle || '',
            EMPLOYEE_TYPE: employeeType || 'full-time',
          },
        });
      } catch (brevoError) {
        // Error adding contact to Brevo
        // Don't fail the request if Brevo fails
      }

      return NextResponse.json({ employee, invitation }, { status: 201 });
    }

    // If no email, create employee without invitation
    const employee = await Employee.create({
      name,
      role,
      jobTitle: jobTitle || undefined,
      team: team || undefined,
      weeklyHours: parseFloat(weeklyHours),
      employeeType: employeeType || 'full-time',
      organizationId: user.organizationId,
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
