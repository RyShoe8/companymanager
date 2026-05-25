import { NextResponse } from 'next/server';
import { connectBillingDb, getBillingContext } from '../../context';
import { SubscriptionAddonModel } from '../../models/SubscriptionAddon';
import { syncAddonToStripe, type AddonForSync } from '../../stripe/syncAddonToStripe';
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
  const addon = await SubscriptionAddonModel.findById(id);
  if (!addon) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const ids = await syncAddonToStripe(addon as AddonForSync);
    addon.set(ids);
    await addon.save();
    return NextResponse.json({ addon: addon.toJSON() });
  } catch (e) {
    console.error('[syncAddonToStripe]', e);
    const msg = e instanceof Error ? e.message : 'Stripe sync failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
