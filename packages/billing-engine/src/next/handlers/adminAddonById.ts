import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectBillingDb, getBillingContext } from '../../context';
import { SubscriptionAddonModel } from '../../models/SubscriptionAddon';
import { validObjectId } from '../../utils/validObjectId';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  interval: z.enum(['month', 'year', 'one_time']).optional(),
  priceCents: z.number().int().nonnegative().optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
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
  const addon = await SubscriptionAddonModel.findById(id).lean();
  if (!addon) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ addon });
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
  const data = parsed.data;
  const $set: Record<string, unknown> = {};
  if (data.name !== undefined) $set.name = data.name.trim();
  if (data.slug !== undefined) $set.slug = data.slug.trim().toLowerCase();
  if (data.interval !== undefined) $set.interval = data.interval;
  if (data.priceCents !== undefined) $set.priceCents = data.priceCents;
  if (data.description !== undefined) $set.description = data.description.trim();
  if (data.active !== undefined) $set.active = data.active;
  await connectBillingDb();
  const addon = await SubscriptionAddonModel.findByIdAndUpdate(id, { $set }, { new: true });
  if (!addon) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ addon });
}

export async function DELETE(_request: Request, { params }: Params) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!validObjectId(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  await connectBillingDb();
  const addon = await SubscriptionAddonModel.findByIdAndUpdate(
    id,
    { $set: { active: false } },
    { new: true }
  );
  if (!addon) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ addon, deactivated: true });
}
