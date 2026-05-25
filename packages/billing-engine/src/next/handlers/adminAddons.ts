import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectBillingDb, getBillingContext } from '../../context';
import { SubscriptionAddonModel } from '../../models/SubscriptionAddon';

export const dynamic = 'force-dynamic';

const CreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  interval: z.enum(['month', 'year', 'one_time']),
  priceCents: z.number().int().nonnegative(),
  description: z.string().optional(),
  active: z.boolean().optional(),
});

async function requireAdmin(): Promise<Response | null> {
  const session = await getBillingContext().auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return getBillingContext().auth.requirePlatformAdmin();
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  await connectBillingDb();
  const addons = await SubscriptionAddonModel.find().sort({ slug: 1 }).lean();
  return NextResponse.json({ addons });
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
  try {
    const addon = await SubscriptionAddonModel.create({
      name: parsed.data.name.trim(),
      slug: parsed.data.slug.trim().toLowerCase(),
      interval: parsed.data.interval,
      priceCents: parsed.data.priceCents,
      description: parsed.data.description?.trim() ?? '',
      active: parsed.data.active ?? true,
    });
    return NextResponse.json({ addon: addon.toObject() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Create failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
