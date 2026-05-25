import type { Stripe } from 'stripe';
import mongoose from 'mongoose';
import type { SubscriptionAddonDoc } from '../models/SubscriptionAddon';
import { getStripe } from '../stripe/client';

export type AddonForSync = SubscriptionAddonDoc & { _id: mongoose.Types.ObjectId };

/**
 * Creates/updates Stripe Product and a new immutable Price for the add-on (same pattern as subscription plans).
 */
export async function syncAddonToStripe(addon: AddonForSync) {
  const stripe = getStripe();
  const meta = {
    tailnoteAddonId: addon._id.toString(),
    tailnoteAddonSlug: addon.slug,
  };

  let productId = addon.stripeProductId;
  if (!productId) {
    const product = await stripe.products.create({
      name: addon.name,
      description: addon.description || undefined,
      metadata: meta,
    });
    productId = product.id;
  } else {
    await stripe.products.update(productId, {
      name: addon.name,
      description: addon.description || undefined,
      metadata: meta,
    });
  }

  const baseParams: Stripe.PriceCreateParams = {
    product: productId,
    currency: 'usd',
    unit_amount: addon.priceCents,
    metadata: meta,
  };

  let priceId = addon.stripePriceId;
  if (addon.interval === 'one_time') {
    const price = await stripe.prices.create(baseParams);
    priceId = price.id;
  } else {
    const price = await stripe.prices.create({
      ...baseParams,
      recurring: { interval: addon.interval === 'year' ? 'year' : 'month' },
    });
    priceId = price.id;
  }

  return { stripeProductId: productId, stripePriceId: priceId };
}
