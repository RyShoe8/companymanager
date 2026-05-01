import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Project, { type IProjectActionButton } from '@/lib/models/Project';
import User from '@/lib/models/User';
import { requireAuth } from '@/lib/auth/middleware';
import { getOrganizationUserIds } from '@/lib/utils/apiHelpers';
import { isValidObjectId } from '@/lib/utils/security';

function isValidEmailFormat(email: string): boolean {
  const t = email.trim();
  if (!t || t.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

/** Decode address from `mailto:encoded@addr` (matches POST encoding). */
function decodeMailtoEmail(mailtoUrl: string): string {
  const m = /^mailto:(.+)$/i.exec(String(mailtoUrl).trim());
  if (!m) return '';
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

function isEmailActionButton(entry: { url?: string; kind?: string }): boolean {
  const url = typeof entry.url === 'string' ? entry.url : '';
  return entry.kind === 'email' || /^mailto:/i.test(url);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;
    await connectDB();
    const { id } = await params;
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
    const project = await Project.findOne({ _id: id, userId: { $in: orgUserIds } }).lean();
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const actionButtons = (project as { actionButtons?: { label: string; url: string; referralSourceId?: unknown }[] }).actionButtons || [];
    return NextResponse.json(actionButtons);
  } catch (error) {
    console.error('Error fetching project buttons:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }
    const Employee = (await import('@/lib/models/Employee')).default;
    const employee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    if (!employee || (employee.role !== 'Manager' && employee.role !== 'Administrator')) {
      return NextResponse.json({ error: 'Forbidden - Manager or Administrator required' }, { status: 403 });
    }
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
    const project = await Project.findOne({ _id: id, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const body = await request.json();
    const { label, url, referralSourceId, kind, email, password } = body;

    const actionButtons = Array.isArray(project.actionButtons) ? [...project.actionButtons] : [];

    if (kind === 'email') {
      const emailRaw = typeof email === 'string' ? email.trim() : '';
      const passwordRaw = typeof password === 'string' ? password : '';
      if (!emailRaw || !passwordRaw.trim()) {
        return NextResponse.json({ error: 'email and password are required for email buttons' }, { status: 400 });
      }
      if (!isValidEmailFormat(emailRaw)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
      }
      const mailtoUrl = `mailto:${encodeURIComponent(emailRaw)}`;
      if (actionButtons.some((b: { url: string }) => b.url === mailtoUrl)) {
        return NextResponse.json({ error: 'Button with this URL already exists' }, { status: 400 });
      }
      const displayLabel =
        typeof label === 'string' && label.trim() ? String(label).trim() : emailRaw;
      actionButtons.push({
        label: displayLabel,
        url: mailtoUrl,
        kind: 'email',
        password: String(passwordRaw),
      });
    } else {
      if (!label || !url) {
        return NextResponse.json({ error: 'label and url are required' }, { status: 400 });
      }
      const urlTrimmed = String(url).trim();
      if (actionButtons.some((b: { url: string }) => b.url === urlTrimmed)) {
        return NextResponse.json({ error: 'Button with this URL already exists' }, { status: 400 });
      }
      actionButtons.push({
        label: String(label).trim(),
        url: urlTrimmed,
        ...(referralSourceId && isValidObjectId(referralSourceId) ? { referralSourceId } : {}),
      });
    }
    project.actionButtons = actionButtons;
    await project.save();
    return NextResponse.json(project.actionButtons, { status: 201 });
  } catch (error) {
    console.error('Error adding project button:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }
    const Employee = (await import('@/lib/models/Employee')).default;
    const employee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    if (!employee || (employee.role !== 'Manager' && employee.role !== 'Administrator')) {
      return NextResponse.json({ error: 'Forbidden - Manager or Administrator required' }, { status: 403 });
    }
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
    const project = await Project.findOne({ _id: id, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    const index = typeof body.index === 'number' ? body.index : parseInt(String(body.index), 10);
    if (isNaN(index) || index < 0) {
      return NextResponse.json({ error: 'Valid index required' }, { status: 400 });
    }
    const actionButtons = Array.isArray(project.actionButtons) ? [...project.actionButtons] : [];
    if (index >= actionButtons.length) {
      return NextResponse.json({ error: 'Index out of range' }, { status: 400 });
    }
    actionButtons.splice(index, 1);
    project.actionButtons = actionButtons;
    await project.save();
    return NextResponse.json(project.actionButtons);
  } catch (error) {
    console.error('Error deleting project button:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;
    await connectDB();
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }
    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }
    const Employee = (await import('@/lib/models/Employee')).default;
    const employee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    if (!employee || (employee.role !== 'Manager' && employee.role !== 'Administrator')) {
      return NextResponse.json({ error: 'Forbidden - Manager or Administrator required' }, { status: 403 });
    }
    const orgUserIds = await getOrganizationUserIds(session.userId, user.organizationId);
    const project = await Project.findOne({ _id: id, userId: { $in: orgUserIds } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    const index = typeof body.index === 'number' ? body.index : parseInt(String(body.index), 10);
    if (isNaN(index) || index < 0) {
      return NextResponse.json({ error: 'Valid index required' }, { status: 400 });
    }
    const actionButtons = Array.isArray(project.actionButtons) ? [...project.actionButtons] : [];
    if (index >= actionButtons.length) {
      return NextResponse.json({ error: 'Index out of range' }, { status: 400 });
    }
    const entry = actionButtons[index] as { label: string; url: string; kind?: string; password?: string };
    if (!isEmailActionButton(entry)) {
      return NextResponse.json({ error: 'Only email smart buttons can be updated here' }, { status: 400 });
    }

    const { label, email, password } = body as {
      label?: unknown;
      email?: unknown;
      password?: unknown;
    };

    if (typeof email === 'string') {
      const emailRaw = email.trim();
      if (!emailRaw || !isValidEmailFormat(emailRaw)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
      }
      const mailtoUrl = `mailto:${encodeURIComponent(emailRaw)}`;
      if (actionButtons.some((b: { url: string }, i: number) => i !== index && b.url === mailtoUrl)) {
        return NextResponse.json({ error: 'Button with this URL already exists' }, { status: 400 });
      }
      entry.url = mailtoUrl;
      entry.kind = 'email';
    }

    if (typeof label === 'string') {
      const t = label.trim();
      const displayEmail = decodeMailtoEmail(entry.url);
      entry.label = t || displayEmail || entry.label;
      entry.kind = 'email';
    }

    // Allow empty string to clear stored password (key icon hidden until set again).
    if ('password' in body && typeof password === 'string') {
      entry.password = password;
      entry.kind = 'email';
    }

    const updatedButton: IProjectActionButton = {
      label: entry.label,
      url: entry.url,
      kind: 'email',
      ...(entry.password !== undefined ? { password: entry.password } : {}),
    };
    actionButtons[index] = updatedButton;
    project.actionButtons = actionButtons;
    await project.save();
    return NextResponse.json(project.actionButtons);
  } catch (error) {
    console.error('Error updating project button:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
