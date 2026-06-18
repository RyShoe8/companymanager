import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import Client from '@/lib/models/Client';
import User from '@/lib/models/User';
import { requireAuth } from '@/lib/auth/middleware';
import { isValidObjectId } from '@/lib/utils/security';
import {
  encryptActionButtonPassword,
  serializeActionButtons,
} from '@/lib/security/actionButtonCrypto';
import type { IProjectActionButton } from '@/lib/models/platformFields';

function isValidEmailFormat(email: string): boolean {
  const t = email.trim();
  if (!t || t.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

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

async function loadClientForOrg(clientId: string, organizationId: unknown) {
  return Client.findOne({ _id: clientId, organizationId });
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
    const client = await loadClientForOrg(id, user.organizationId);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    const Employee = (await import('@/lib/models/Employee')).default;
    const employee = await Employee.findOne({ userId: session.userId, organizationId: user.organizationId });
    const canViewPasswords = employee?.role === 'Manager' || employee?.role === 'Administrator';
    const actionButtons = client.actionButtons ?? [];
    return NextResponse.json(serializeActionButtons(actionButtons, canViewPasswords));
  } catch (error) {
    console.error('Error fetching client buttons:', error);
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
      return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
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
    const client = await loadClientForOrg(id, user.organizationId);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    const body = await request.json();
    const { label, url, referralSourceId, kind, email, password } = body;
    const actionButtons = Array.isArray(client.actionButtons) ? [...client.actionButtons] : [];

    if (kind === 'email') {
      const emailRaw = typeof email === 'string' ? email.trim() : '';
      const passwordRaw = typeof password === 'string' ? password : '';
      if (!emailRaw) {
        return NextResponse.json({ error: 'email is required for email buttons' }, { status: 400 });
      }
      if (!isValidEmailFormat(emailRaw)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
      }
      const mailtoUrl = `mailto:${encodeURIComponent(emailRaw)}`;
      if (actionButtons.some((b) => b.url === mailtoUrl)) {
        return NextResponse.json({ error: 'Button with this URL already exists' }, { status: 400 });
      }
      const displayLabel = typeof label === 'string' && label.trim() ? String(label).trim() : emailRaw;
      actionButtons.push({
        label: displayLabel,
        url: mailtoUrl,
        kind: 'email',
        ...(passwordRaw.trim() ? { password: encryptActionButtonPassword(passwordRaw.trim()) } : {}),
      });
    } else {
      if (!label || !url) {
        return NextResponse.json({ error: 'label and url are required' }, { status: 400 });
      }
      const urlTrimmed = String(url).trim();
      if (actionButtons.some((b) => b.url === urlTrimmed)) {
        return NextResponse.json({ error: 'Button with this URL already exists' }, { status: 400 });
      }
      actionButtons.push({
        label: String(label).trim(),
        url: urlTrimmed,
        ...(referralSourceId && isValidObjectId(referralSourceId) ? { referralSourceId } : {}),
      });
    }
    client.actionButtons = actionButtons;
    await client.save();

    void import('@/lib/workspace/workspaceNotifications').then(({ notifyClientChange }) => {
      void notifyClientChange({
        client,
        actorUserId: session.userId,
        actorEmployeeId: employee._id.toString(),
        organizationId: user.organizationId!.toString(),
        isNew: false,
        changeLabel: 'Client action button added',
      }).catch((err) => console.error('[workspaceNotifications] client_update', err));
    });

    return NextResponse.json(serializeActionButtons(client.actionButtons, true), { status: 201 });
  } catch (error) {
    console.error('Error adding client button:', error);
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
      return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
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
    const client = await loadClientForOrg(id, user.organizationId);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    const index = typeof body.index === 'number' ? body.index : parseInt(String(body.index), 10);
    if (isNaN(index) || index < 0) {
      return NextResponse.json({ error: 'Valid index required' }, { status: 400 });
    }
    const actionButtons = Array.isArray(client.actionButtons) ? [...client.actionButtons] : [];
    if (index >= actionButtons.length) {
      return NextResponse.json({ error: 'Index out of range' }, { status: 400 });
    }
    actionButtons.splice(index, 1);
    client.actionButtons = actionButtons;
    await client.save();

    void import('@/lib/workspace/workspaceNotifications').then(({ notifyClientChange }) => {
      void notifyClientChange({
        client,
        actorUserId: session.userId,
        actorEmployeeId: employee._id.toString(),
        organizationId: user.organizationId!.toString(),
        isNew: false,
        changeLabel: 'Client action button removed',
      }).catch((err) => console.error('[workspaceNotifications] client_update', err));
    });

    return NextResponse.json(serializeActionButtons(client.actionButtons, true));
  } catch (error) {
    console.error('Error deleting client button:', error);
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
      return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
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
    const client = await loadClientForOrg(id, user.organizationId);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    const index = typeof body.index === 'number' ? body.index : parseInt(String(body.index), 10);
    if (isNaN(index) || index < 0) {
      return NextResponse.json({ error: 'Valid index required' }, { status: 400 });
    }
    const actionButtons = Array.isArray(client.actionButtons) ? [...client.actionButtons] : [];
    if (index >= actionButtons.length) {
      return NextResponse.json({ error: 'Index out of range' }, { status: 400 });
    }
    const entry = actionButtons[index];
    if (!isEmailActionButton(entry)) {
      return NextResponse.json({ error: 'Only email smart buttons can be updated here' }, { status: 400 });
    }
    const { label, email, password } = body as { label?: unknown; email?: unknown; password?: unknown };
    if (typeof email === 'string') {
      const emailRaw = email.trim();
      if (!emailRaw || !isValidEmailFormat(emailRaw)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
      }
      const mailtoUrl = `mailto:${encodeURIComponent(emailRaw)}`;
      if (actionButtons.some((b, i) => i !== index && b.url === mailtoUrl)) {
        return NextResponse.json({ error: 'Button with this URL already exists' }, { status: 400 });
      }
      entry.url = mailtoUrl;
      entry.kind = 'email';
    }
    if (typeof label === 'string') {
      const t = label.trim();
      entry.label = t || decodeMailtoEmail(entry.url) || entry.label;
      entry.kind = 'email';
    }
    if ('password' in body && typeof password === 'string') {
      entry.password = password ? encryptActionButtonPassword(password) : '';
      entry.kind = 'email';
    }
    const updatedButton: IProjectActionButton = {
      label: entry.label,
      url: entry.url,
      kind: 'email',
      ...(entry.password !== undefined ? { password: entry.password } : {}),
    };
    actionButtons[index] = updatedButton;
    client.actionButtons = actionButtons;
    await client.save();

    void import('@/lib/workspace/workspaceNotifications').then(({ notifyClientChange }) => {
      void notifyClientChange({
        client,
        actorUserId: session.userId,
        actorEmployeeId: employee._id.toString(),
        organizationId: user.organizationId!.toString(),
        isNew: false,
        changeLabel: 'Client action button updated',
      }).catch((err) => console.error('[workspaceNotifications] client_update', err));
    });

    return NextResponse.json(serializeActionButtons(client.actionButtons, true));
  } catch (error) {
    console.error('Error updating client button:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
