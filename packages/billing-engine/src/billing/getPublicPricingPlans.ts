import { connectBillingDb } from '../context';
import { SubscriptionPlanModel, type SubscriptionPlanDoc } from '../models/SubscriptionPlan';
import { mapPlanDocToPublicPricing } from '../billing/mapPlanDocToPublicPricing';
import type { PublicPricingPlan } from '../types/publicPricing';

export type { PublicPricingPlan, PublicPricingYearlyOffer } from '../types/publicPricing';

/** Legacy Tailnote seed slugs — never show on Nucleas public pricing. */
export const LEGACY_PLACEHOLDER_SLUGS = ['basic', 'pro'] as const;

const legacyPlaceholderSlugSet = new Set<string>(LEGACY_PLACEHOLDER_SLUGS);

/** Serializable plan row for marketing / pricing UI (latest version per slug). */

/**
 * Active, non-paused, non-archived plans for public pricing — one card per slug (highest version).
 * Plans that have reached maxSubscriptionSlots are omitted (sold out).
 * Legacy basic/pro placeholder slugs are excluded.
 */
export async function getPublicPricingPlans(): Promise<PublicPricingPlan[]> {
  await connectBillingDb();

  const rows = await SubscriptionPlanModel.find({ active: true, paused: false, archived: false })
    .sort({ slug: 1, version: -1 })
    .lean<SubscriptionPlanDoc[]>();

  const seen = new Set<string>();
  const out: PublicPricingPlan[] = [];

  for (const r of rows) {
    const slug = String(r.slug ?? '');
    if (!slug || seen.has(slug) || legacyPlaceholderSlugSet.has(slug)) continue;
    seen.add(slug);

    out.push(await mapPlanDocToPublicPricing(r));
  }

  return out.filter((p) => !p.soldOut);
}
