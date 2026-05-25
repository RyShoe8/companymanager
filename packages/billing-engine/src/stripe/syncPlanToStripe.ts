import type { Stripe } from 'stripe';
import mongoose from 'mongoose';
import type { SubscriptionPlanDoc } from '../models/SubscriptionPlan';
import { getStripe } from '../stripe/client';

export type PlanForSync = SubscriptionPlanDoc & { _id: mongoose.Types.ObjectId };

function recurringForInterval(
  interval: SubscriptionPlanDoc['interval']
): Stripe.PriceCreateParams.Recurring | undefined {
  if (interval === 'lifetime') return undefined;
  return {
    interval: interval === 'year' ? 'year' : 'month',
    usage_type: 'licensed',
  };
}

/**
 * Creates/updates Stripe Product and new immutable Price rows for the plan.
 * Paused plans still sync metadata but checkout should filter them out.
 */
export async function syncPlanToStripe(plan: PlanForSync) {
  const stripe = getStripe();
  const meta = {
    tailnoteSubscriptionPlanId: plan._id.toString(),
    tailnotePlanSlug: plan.slug,
    tailnotePlanVersion: String(plan.version),
  };

  let productId = plan.stripeProductId;
  if (!productId) {
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description || undefined,
      metadata: meta,
    });
    productId = product.id;
  } else {
    await stripe.products.update(productId, {
      name: plan.name,
      description: plan.description || undefined,
      metadata: meta,
    });
  }

  let basePriceId = plan.stripeBasePriceId;
  const baseParams: Stripe.PriceCreateParams = {
    product: productId,
    currency: 'usd',
    unit_amount: plan.basePriceCents,
    metadata: meta,
  };

  if (plan.interval === 'lifetime') {
    const price = await stripe.prices.create(baseParams);
    basePriceId = price.id;
  } else {
    const price = await stripe.prices.create({
      ...baseParams,
      recurring: recurringForInterval(plan.interval),
    });
    basePriceId = price.id;
  }

  let seatPriceId = plan.stripeSeatPriceId;
  if (plan.additionalUserPriceCents > 0 && plan.interval !== 'lifetime') {
    const seat = await stripe.prices.create({
      product: productId,
      currency: 'usd',
      unit_amount: plan.additionalUserPriceCents,
      recurring: {
        interval: plan.interval === 'year' ? 'year' : 'month',
        usage_type: 'licensed',
      },
      metadata: { ...meta, tailnotePriceRole: 'seat' },
    });
    seatPriceId = seat.id;
  } else {
    seatPriceId = '';
  }

  return {
    stripeProductId: productId,
    stripeBasePriceId: basePriceId,
    stripeSeatPriceId: seatPriceId,
  };
}
