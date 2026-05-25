import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ChangePlanError,
  changeStripeSubscriptionPlan,
} from '../../billing/changeStripeSubscriptionPlan';
import { requireOwnerBilling } from '../../billing/requireOwnerSubscription';
import { getBillingContext } from '../../context';

const BodySchema = z.object({
  subscriptionPlanId: z.string().min(1),
});

export async function POST(request: Request) {
  const gate = await requireOwnerBilling();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const session = await getBillingContext().auth.getSession();
  const userEmail = session?.user?.email;

  try {
    const result = await changeStripeSubscriptionPlan({
      org: gate.ctx.org,
      userEmail,
      subscriptionPlanId: parsed.data.subscriptionPlanId,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ChangePlanError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[change-plan]', err);
    return NextResponse.json({ error: 'Could not change plan' }, { status: 500 });
  }
}
