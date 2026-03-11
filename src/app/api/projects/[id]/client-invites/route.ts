import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project from '@/lib/models/Project';
import User from '@/lib/models/User';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import { sendClientPortalInviteEmail } from '@/lib/services/email';

/**
 * POST /api/projects/[id]/client-invites
 * Body: { email: string }
 * Sends client portal invite email and adds email to project.invitedClientEmails.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    await connectDB();
    const { id } = await params;

    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    const Employee = (await import('@/lib/models/Employee')).default;
    const currentUserEmployee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    const isManagerOrAdmin = currentUserEmployee && (currentUserEmployee.role === 'Manager' || currentUserEmployee.role === 'Administrator');
    if (!isManagerOrAdmin) {
      return NextResponse.json({ error: 'Only Managers and Administrators can invite clients' }, { status: 403 });
    }

    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
    const project = await Project.findOne({ _id: id, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.projectType !== 'client') {
      return NextResponse.json({ error: 'Only client projects can have client invites' }, { status: 400 });
    }

    if (!project.clientPortalSlug) {
      return NextResponse.json({ error: 'Project has no portal link. Save the project as Client type first.' }, { status: 400 });
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'https://nucleas.app';
    const portalLink = project.clientPortalToken
      ? `${baseUrl}/portal/${project.clientPortalSlug}?token=${encodeURIComponent(project.clientPortalToken)}`
      : `${baseUrl}/portal/${project.clientPortalSlug}`;

    try {
      await sendClientPortalInviteEmail({
        recipientEmail: normalizedEmail,
        projectName: project.name,
        portalLink,
        inviterName: user.name || undefined,
      });
    } catch (e) {
      console.error('Client invite email error:', e);
      return NextResponse.json({ error: 'Failed to send invite email' }, { status: 500 });
    }

    const invitedList = project.invitedClientEmails || [];
    if (!invitedList.includes(normalizedEmail)) {
      project.invitedClientEmails = [...invitedList, normalizedEmail];
      await project.save();
    }

    return NextResponse.json({ success: true, message: 'Invite sent' });
  } catch (error) {
    console.error('Client invites error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
