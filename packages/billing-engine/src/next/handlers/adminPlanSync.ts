import { NextResponse } from 'next/server';
import { connectBillingDb, getBillingContext } from '../../context';
import { SubscriptionPlanModel } from '../../models/SubscriptionPlan';
import { syncPlanToStripe, type PlanForSync } from '../../stripe/syncPlanToStripe';
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
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }
  await connectBillingDb();
  const plan = await SubscriptionPlanModel.findById(id);
  if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const ids = await syncPlanToStripe(plan as PlanForSync);
    plan.set(ids);
    await plan.save();
    return NextResponse.json({ plan: plan.toJSON() });
  } catch (e) {
    console.error('[syncPlanToStripe]', e);
    const msg = e instanceof Error ? e.message : 'Stripe sync failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
