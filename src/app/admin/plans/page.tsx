import '@/lib/billing-engine';
import connectDB from '@/lib/db/mongodb';
import CreatePlanButton from '@/app/admin/plans/CreatePlanButton';
import {
  SubscriptionPlanModel,
  type SubscriptionPlanDoc,
} from 'billing-engine/models';
import { getPlanSubscriptionCapUsage } from 'billing-engine';
import { AdminPlansTable, type PlanRow } from 'billing-engine/next/components';

export const dynamic = 'force-dynamic';

export default async function AdminPlansPage() {
  await connectDB();
  const raw = await SubscriptionPlanModel.find({ archived: false })
    .sort({ slug: 1, version: -1 })
    .lean<SubscriptionPlanDoc[]>();

  const initialPlans: PlanRow[] = await Promise.all(
    raw.map(async (p) => {
      const usage = await getPlanSubscriptionCapUsage(p);
      return {
        _id: String(p._id),
        name: String(p.name ?? ''),
        slug: String(p.slug ?? ''),
        interval: String(p.interval ?? 'year'),
        basePriceCents: Number(p.basePriceCents ?? 0),
        additionalUserPriceCents: Number(p.additionalUserPriceCents ?? 0),
        includedUsers: Number(p.includedUsers ?? 1),
        active: Boolean(p.active),
        paused: Boolean(p.paused),
        archived: Boolean(p.archived),
        version: Number(p.version ?? 1),
        stripeBasePriceId: p.stripeBasePriceId ? String(p.stripeBasePriceId) : '',
        maxSubscriptionSlots: Number(p.maxSubscriptionSlots ?? 0),
        subscriptionCount: usage.used,
        soldOut: usage.soldOut,
        trialDays: Number(p.trialDays ?? 0),
      };
    })
  );

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-[100px] py-8">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-text-primary">Subscription plans</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Source of truth for pricing. Sync creates Stripe products and immutable prices.
            </p>
          </div>
          <CreatePlanButton />
        </div>
        <AdminPlansTable initialPlans={initialPlans} mode="active" />
      </div>
    </div>
  );
}
