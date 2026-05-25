import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectBillingDb, getBillingContext, getOrganizationModel } from '../../context';
import { getPublicPricingPlans } from '../../billing/getPublicPricingPlans';
import {
  getEmployeeLimitsForOrganization,
  resolveOrganizationSubscriptionPlan,
} from '../../billing/employeeLimits';
import { mapPlanDocToPublicPricing } from '../../billing/mapPlanDocToPublicPricing';
import { buildOrganizationBillingSummary } from '../../billing/organizationBillingSummary';
import type { OrganizationSubscriptionDoc } from '../../models/OrganizationSubscription';
import { OrganizationSubscriptionModel } from '../../models/OrganizationSubscription';
import type { SubscriptionPlanDoc } from '../../models/SubscriptionPlan';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getBillingContext().auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user;
  if (!user.organizationId) {
    return NextResponse.json({
      organization: null,
      billing: null,
      currentPlan: null,
      availablePlans: [],
      seatLimits: null,
      viewer: { role: user.role ?? 'member' },
    });
  }

  await connectBillingDb();
  const OrganizationModel = getOrganizationModel();
  const orgObjId = new mongoose.Types.ObjectId(user.organizationId);
  const [organization, orgSubRaw, availablePlans, seatLimits] = await Promise.all([
    OrganizationModel.findById(user.organizationId).lean(),
    OrganizationSubscriptionModel.findOne({ organizationId: orgObjId })
      .populate<{ subscriptionPlanId: SubscriptionPlanDoc | null }>('subscriptionPlanId')
      .lean(),
    getPublicPricingPlans(),
    getEmployeeLimitsForOrganization(user.organizationId),
  ]);

  const orgSub = orgSubRaw as
    | (OrganizationSubscriptionDoc & { subscriptionPlanId?: SubscriptionPlanDoc | null })
    | null;

  let currentPlan = null;
  const populated = orgSub?.subscriptionPlanId;
  if (populated && typeof populated === 'object' && '_id' in populated) {
    currentPlan = await mapPlanDocToPublicPricing(populated as SubscriptionPlanDoc);
  } else {
    const resolved = await resolveOrganizationSubscriptionPlan(user.organizationId);
    if (resolved) {
      currentPlan = await mapPlanDocToPublicPricing(resolved);
    }
  }

  const billing = buildOrganizationBillingSummary(organization, orgSub, user.role ?? 'member', {
    currentPlan,
    availablePlans,
    seatLimits,
  });

  return NextResponse.json({
    organization,
    billing,
    currentPlan,
    availablePlans,
    seatLimits,
    viewer: { role: user.role ?? 'member' },
  });
}
