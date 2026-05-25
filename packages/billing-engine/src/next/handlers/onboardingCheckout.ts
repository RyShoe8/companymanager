import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { z } from 'zod';
import { connectBillingDb, getBillingContext, getOrganizationModel } from '../../context';
import { OrganizationSubscriptionModel } from '../../models/OrganizationSubscription';
import { SubscriptionPlanModel, type SubscriptionPlanDoc } from '../../models/SubscriptionPlan';
import { validObjectId } from '../../utils/validObjectId';
import {
  checkoutErrorToResponse,
  createCheckoutSessionForOrganization,
  validatePlanForCheckout,
  CheckoutSessionError,
} from '../../billing/createCheckoutSession';
import { stripeBillingEnabled } from '../../billing/subscriptionAccess';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  subscriptionPlanId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    if (!stripeBillingEnabled()) {
      return NextResponse.json({ error: 'Billing is not configured' }, { status: 503 });
    }

    const session = await getBillingContext().auth.getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = session.user;
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Create an organization first' }, { status: 400 });
    }
    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Only the organization owner can subscribe' }, { status: 403 });
    }

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(' ');
      return NextResponse.json({ error: message || 'Invalid request' }, { status: 400 });
    }

    const planId = parsed.data.subscriptionPlanId.trim();
    if (!validObjectId(planId)) {
      return NextResponse.json({ error: 'Invalid subscription plan' }, { status: 400 });
    }

    await connectBillingDb();
    const OrganizationModel = getOrganizationModel();
    const org = await OrganizationModel.findById(user.organizationId);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const dbPlan = await SubscriptionPlanModel.findById(planId).lean<SubscriptionPlanDoc>();
    if (!dbPlan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    try {
      await validatePlanForCheckout(dbPlan, org._id.toString());
    } catch (e) {
      if (e instanceof CheckoutSessionError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

    await OrganizationSubscriptionModel.findOneAndUpdate(
      { organizationId: org._id },
      {
        $set: {
          subscriptionPlanId: new mongoose.Types.ObjectId(planId),
          status: 'incomplete',
        },
      },
      { upsert: true }
    );

    const base = getBillingContext().billing.getAppBaseUrl();
    const { url: checkoutUrl } = await createCheckoutSessionForOrganization({
      org,
      userEmail: user.email,
      subscriptionPlanId: planId,
      successUrl: `${base}/dashboard?checkout=success`,
      cancelUrl: `${base}/onboarding?checkout=cancelled`,
    });

    return NextResponse.json({ checkoutUrl });
  } catch (err) {
    return checkoutErrorToResponse(err);
  }
}
