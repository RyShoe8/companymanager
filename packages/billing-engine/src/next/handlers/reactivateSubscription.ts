import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectBillingDb } from '../../context';
import { requireOwnerWithStripeSubscription } from '../../billing/requireOwnerSubscription';
import { OrganizationSubscriptionModel } from '../../models/OrganizationSubscription';
import { getStripe } from '../../stripe/client';

export async function POST() {
  const gate = await requireOwnerWithStripeSubscription();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { org, organizationId } = gate.ctx;
  const subId = org.stripeSubscriptionId!.trim();

  const stripe = getStripe();
  const sub = await stripe.subscriptions.update(subId, {
    cancel_at_period_end: false,
  });

  const renewsAt =
    typeof sub.current_period_end === 'number'
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;

  await connectBillingDb();
  const orgObjId = new mongoose.Types.ObjectId(organizationId);
  const patch: Record<string, unknown> = {
    cancelAtPeriodEnd: false,
  };
  if (renewsAt) patch.renewsAt = new Date(renewsAt);

  await OrganizationSubscriptionModel.findOneAndUpdate(
    { organizationId: orgObjId },
    { $set: patch }
  );

  return NextResponse.json({
    cancelAtPeriodEnd: false,
    renewsAt,
  });
}
