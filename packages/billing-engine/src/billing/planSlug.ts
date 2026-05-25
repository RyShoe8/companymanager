import { connectBillingDb } from '../context';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan';

/** Lowercase URL-safe slug from a plan display name. */
export function slugifyPlanName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'plan';
}

/** First slug not yet used by any plan document (any version). */
export async function uniquePlanSlugForName(name: string): Promise<string> {
  await connectBillingDb();
  const base = slugifyPlanName(name);
  let candidate = base;
  let n = 2;
  while (await SubscriptionPlanModel.exists({ slug: candidate })) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}
