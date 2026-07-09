import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db/mongodb';
import { requirePlatformAdmin } from '@/lib/auth/requirePlatformAdmin';
import Organization from '@/lib/models/Organization';
import { assignOrganizationPlan } from 'billing-engine';
import mongoose from 'mongoose';

const ALLOWED_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete',
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePlatformAdmin();
    if (auth.error) return auth.error;

    await connectDB();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid organization id' }, { status: 400 });
    }

    const body = await request.json();
    const planId = body?.planId;
    if (!planId || !mongoose.Types.ObjectId.isValid(planId)) {
      return NextResponse.json({ error: 'Valid planId is required' }, { status: 400 });
    }

    const status =
      typeof body?.status === 'string' && ALLOWED_STATUSES.has(body.status)
        ? body.status
        : undefined;

    const org = await Organization.findById(id);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    await assignOrganizationPlan(
      org._id as mongoose.Types.ObjectId,
      new mongoose.Types.ObjectId(planId),
      status
    );

    const updated = await Organization.findById(id).lean();

    return NextResponse.json({
      organizationMongoId: id,
      plan: updated?.plan ?? 'none',
      subscriptionStatus: updated?.subscriptionStatus ?? 'none',
      planId,
    });
  } catch (error) {
    console.error('Admin org subscription PATCH error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (message.includes('Plan not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
