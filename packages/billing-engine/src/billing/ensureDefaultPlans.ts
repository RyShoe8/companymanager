import { connectBillingDb } from '../context';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan';

/** Idempotent seed for Basic/Pro yearly plans (amounts match marketing defaults; edit in admin). */
export async function ensureDefaultSubscriptionPlans(): Promise<void> {
  await connectBillingDb();
  const basic = await SubscriptionPlanModel.findOne({ slug: 'basic', version: 1 });
  if (!basic) {
    await SubscriptionPlanModel.create({
      name: 'Basic',
      slug: 'basic',
      active: true,
      paused: false,
      interval: 'year',
      basePriceCents: 1000,
      additionalUserPriceCents: 0,
      includedUsers: 1,
      description: 'Core email signature features',
      version: 1,
      maxSubscriptionSlots: 0,
      archived: false,
    });
  }
  const pro = await SubscriptionPlanModel.findOne({ slug: 'pro', version: 1 });
  if (!pro) {
    await SubscriptionPlanModel.create({
      name: 'Pro',
      slug: 'pro',
      active: true,
      paused: false,
      interval: 'year',
      basePriceCents: 2000,
      additionalUserPriceCents: 0,
      includedUsers: 1,
      description: 'Advanced layouts and promotional blocks',
      version: 1,
      maxSubscriptionSlots: 0,
      archived: false,
    });
  }
}
