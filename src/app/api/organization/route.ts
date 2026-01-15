import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import Organization from '@/lib/models/Organization';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Check if user is the organization admin
    const isAdmin = user._id.toString() === user.organizationId;

    if (!isAdmin) {
      return NextResponse.json({ error: 'Only organization administrators can view organization settings' }, { status: 403 });
    }

    // Find or create organization
    let organization = await Organization.findOne({ userId: user._id });

    if (!organization) {
      // Create default organization
      organization = await Organization.create({
        userId: user._id,
        name: user.name || 'My Organization',
      });
    }

    return NextResponse.json({
      name: organization.name,
      domain: organization.domain,
    });
  } catch (error) {
    console.error('Get organization error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, domain } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
    }

    await connectDB();

    const user = await User.findById(session.userId);
    if (!user || !user.organizationId) {
      return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
    }

    // Check if user is the organization admin
    const isAdmin = user._id.toString() === user.organizationId;

    if (!isAdmin) {
      return NextResponse.json({ error: 'Only organization administrators can update organization settings' }, { status: 403 });
    }

    // Find or create organization
    let organization = await Organization.findOne({ userId: user._id });

    if (!organization) {
      organization = await Organization.create({
        userId: user._id,
        name: name.trim(),
        domain: domain?.trim() || undefined,
      });
    } else {
      organization.name = name.trim();
      if (domain !== undefined) {
        organization.domain = domain.trim() || undefined;
      }
      await organization.save();
    }

    // Mark organization setup as complete
    user.organizationSetupComplete = true;
    await user.save();

    return NextResponse.json({
      message: 'Organization updated successfully',
      organization: {
        name: organization.name,
        domain: organization.domain,
      },
    });
  } catch (error) {
    console.error('Update organization error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
