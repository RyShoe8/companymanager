import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectBillingDb, getBillingContext } from '../../context';
import { SubscriptionPlanModel } from '../../models/SubscriptionPlan';
import { OrganizationSubscriptionModel } from '../../models/OrganizationSubscription';
import { archivePlanInStripe } from '../../stripe/archivePlanInStripe';
import { validObjectId } from '../../utils/validObjectId';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  interval: z.enum(['month', 'year', 'lifetime']).optional(),
  basePriceCents: z.number().int().nonnegative().optional(),
  additionalUserPriceCents: z.number().int().nonnegative().optional(),
  includedUsers: z.number().int().min(1).optional(),
  description: z.string().optional(),
  badge: z.string().optional(),
  active: z.boolean().optional(),
  paused: z.boolean().optional(),
  maxSubscriptionSlots: z.number().int().nonnegative().optional(),
  trialDays: z.number().int().min(0).max(365).optional(),
  yearlyOffer: z
    .object({
      enabled: z.boolean(),
      basePriceCents: z.number().int().nonnegative(),
      additionalUserPriceCents: z.number().int().nonnegative(),
    })
    .optional(),
  onboardingCallsEnabled: z.boolean().optional(),
  archived: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

async function requireAdmin(): Promise<Response | null> {
  const session = await getBillingContext().auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return getBillingContext().auth.requirePlatformAdmin();
}

export async function GET(_request: Request, { params }: Params) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!validObjectId(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  await connectBillingDb();
  const plan = await SubscriptionPlanModel.findById(id).lean();
  if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ plan });
}

export async function PATCH(request: Request, { params }: Params) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!validObjectId(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields' }, { status: 400 });
  }
  await connectBillingDb();
  const $set = { ...parsed.data } as Record<string, unknown>;
  if ($set.archived === true) {
    $set.paused = true;
  }
  const plan = await SubscriptionPlanModel.findByIdAndUpdate(id, { $set }, { new: true });
  if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ plan });
}

export async function DELETE(_request: Request, { params }: Params) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!validObjectId(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  await connectBillingDb();

  const plan = await SubscriptionPlanModel.findById(id);
  if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const activeSubCount = await OrganizationSubscriptionModel.countDocuments({
    subscriptionPlanId: plan._id,
    status: { $in: ['active', 'trialing', 'past_due'] },
  });
  if (activeSubCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: ${activeSubCount} organization(s) have an active subscription on this plan. Archive the plan instead.`,
      },
      { status: 409 }
    );
  }

  const stripeProductId = plan.stripeProductId?.trim();
  if (stripeProductId && process.env.STRIPE_SECRET_KEY) {
    const archived = await archivePlanInStripe(plan);
    if (!archived.ok) {
      return NextResponse.json(
        { error: archived.error ?? 'Failed to archive plan in Stripe' },
        { status: 502 }
      );
    }
  }

  await SubscriptionPlanModel.findByIdAndDelete(id);
  return NextResponse.json({ deleted: true, id });
}
