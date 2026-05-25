import { getBillingContext } from '../context';

/**
 * Stripe price IDs — set in env or via createBillingEngine stripe.legacyPriceIds.
 */
export function getStripePriceIds(): { basic: string; pro: string } {
  try {
    const legacy = getBillingContext().stripe?.legacyPriceIds;
    if (legacy) {
      return {
        basic: legacy.basic ?? process.env.STRIPE_BASIC_PRICE_ID ?? '',
        pro: legacy.pro ?? process.env.STRIPE_PRO_PRICE_ID ?? '',
      };
    }
  } catch {
    /* context not initialized */
  }
  return {
    basic: process.env.STRIPE_BASIC_PRICE_ID ?? '',
    pro: process.env.STRIPE_PRO_PRICE_ID ?? '',
  };
}

/** Host apps may use this for product-specific entitlements (e.g. template caps). */
export const MAX_TEMPLATES_BASIC = 4;
