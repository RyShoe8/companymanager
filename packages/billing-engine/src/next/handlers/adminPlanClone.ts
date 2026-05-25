import { NextResponse } from 'next/server';
import { connectBillingDb, getBillingContext } from '../../context';
import { SubscriptionPlanModel } from '../../models/SubscriptionPlan';
import { validObjectId } from '../../utils/validObjectId';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

async function requireAdmin(): Promise<Response | null> {
  const session = await getBillingContext().auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return getBillingContext().auth.requirePlatformAdmin();
}

export async function POST(_request: Request, { params }: Params) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!validObjectId(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  await connectBillingDb();
  const src = await SubscriptionPlanModel.findById(id).lean();
  if (!src) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const latest = await SubscriptionPlanModel.findOne({ slug: src.slug })
    .sort({ version: -1 })
    .select('version')
    .lean();
  const nextVersion = (latest?.version ?? 0) + 1;
  const plan = await SubscriptionPlanModel.create({
    name: src.name,
    slug: src.slug,
    active: src.active,
    paused: false,
    interval: src.interval,
    basePriceCents: src.basePriceCents,
    additionalUserPriceCents: src.additionalUserPriceCents,
    includedUsers: src.includedUsers,
    description: src.description,
    badge: src.badge ?? '',
    maxSubscriptionSlots: src.maxSubscriptionSlots ?? 0,
    archived: false,
    version: nextVersion,
    stripeProductId: '',
    stripeBasePriceId: '',
    stripeSeatPriceId: '',
  });
  return NextResponse.json({ plan });
}
