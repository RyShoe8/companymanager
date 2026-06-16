import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectBillingDb, getBillingContext } from '../../context';
import { SubscriptionPlanModel, type SubscriptionPlanDoc } from '../../models/SubscriptionPlan';
import { getPlanSubscriptionCapUsage } from '../../billing/planSubscriptionCap';
import { uniquePlanSlugForName } from '../../billing/planSlug';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  name: z.string().min(1),
  interval: z.enum(['month', 'year', 'lifetime']),
  basePriceCents: z.number().int().nonnegative(),
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

async function enrichPlans(plans: SubscriptionPlanDoc[]) {
  return Promise.all(
    plans.map(async (p) => {
      const usage = await getPlanSubscriptionCapUsage(p);
      return {
        ...p,
        subscriptionCount: usage.used,
        slotsRemaining: usage.remaining,
        soldOut: usage.soldOut,
      };
    })
  );
}

async function requireAdmin(): Promise<Response | null> {
  const session = await getBillingContext().auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return getBillingContext().auth.requirePlatformAdmin();
}

export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  await connectBillingDb();

  const url = new URL(request.url);
  const archived = url.searchParams.get('archived') === 'true';

  const plans = await SubscriptionPlanModel.find({ archived })
    .sort({ slug: 1, version: -1 })
    .lean<SubscriptionPlanDoc[]>();

  const enriched = await enrichPlans(plans);
  return NextResponse.json({ plans: enriched });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  await connectBillingDb();
  const slug = await uniquePlanSlugForName(parsed.data.name);
  try {
    const plan = await SubscriptionPlanModel.create({
      ...parsed.data,
      slug,
      version: 1,
      additionalUserPriceCents: parsed.data.additionalUserPriceCents ?? 0,
      includedUsers: parsed.data.includedUsers ?? 1,
      description: parsed.data.description ?? '',
      badge: parsed.data.badge ?? '',
      active: parsed.data.active ?? true,
      paused: parsed.data.paused ?? false,
      maxSubscriptionSlots: parsed.data.maxSubscriptionSlots ?? 0,
      archived: parsed.data.archived ?? false,
    });
    return NextResponse.json({ plan });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Create failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
