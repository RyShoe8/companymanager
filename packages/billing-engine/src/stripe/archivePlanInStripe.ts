import type { SubscriptionPlanDoc } from '../models/SubscriptionPlan';
import { getStripe } from './client';

export type PlanStripeArchiveInput = Pick<
  SubscriptionPlanDoc,
  'stripeProductId' | 'stripeBasePriceId' | 'stripeSeatPriceId' | 'yearlyOffer'
>;

export type ArchivePlanInStripeResult = { ok: true } | { ok: false; error: string };

function isResourceMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; statusCode?: number };
  return e.code === 'resource_missing' || e.statusCode === 404;
}

function collectPriceIds(plan: PlanStripeArchiveInput): string[] {
  const ids = new Set<string>();
  const add = (id: string | undefined | null) => {
    const trimmed = typeof id === 'string' ? id.trim() : '';
    if (trimmed) ids.add(trimmed);
  };
  add(plan.stripeBasePriceId);
  add(plan.stripeSeatPriceId);
  add(plan.yearlyOffer?.stripeBasePriceId);
  add(plan.yearlyOffer?.stripeSeatPriceId);
  return [...ids];
}

/** Archives linked Stripe prices and product (active: false). Stripe prices cannot be hard-deleted. */
export async function archivePlanInStripe(
  plan: PlanStripeArchiveInput
): Promise<ArchivePlanInStripeResult> {
  const productId = plan.stripeProductId?.trim();
  if (!productId) {
    return { ok: true };
  }

  const stripe = getStripe();
  const priceIds = collectPriceIds(plan);

  const priceResults = await Promise.allSettled(
    priceIds.map((id) => stripe.prices.update(id, { active: false }))
  );

  const priceErrors: string[] = [];
  for (let i = 0; i < priceResults.length; i++) {
    const result = priceResults[i];
    if (result.status === 'rejected' && !isResourceMissing(result.reason)) {
      const msg =
        result.reason instanceof Error ? result.reason.message : String(result.reason);
      priceErrors.push(`price ${priceIds[i]}: ${msg}`);
    }
  }

  if (priceErrors.length > 0) {
    return { ok: false, error: `Failed to archive Stripe prices: ${priceErrors.join('; ')}` };
  }

  try {
    await stripe.products.update(productId, { active: false });
  } catch (e) {
    if (isResourceMissing(e)) {
      return { ok: true };
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[archivePlanInStripe] product archive failed', productId, e);
    return { ok: false, error: `Failed to archive Stripe product: ${msg}` };
  }

  return { ok: true };
}
