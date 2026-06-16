import Link from 'next/link';
import { notFound } from 'next/navigation';
import mongoose from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import {
  SubscriptionPlanModel,
  type SubscriptionPlanDoc,
} from 'billing-engine/models';
import { AdminPlanForm } from 'billing-engine/next/components';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function EditAdminPlanPage({ params }: Props) {
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) notFound();

  await connectDB();
  const p = await SubscriptionPlanModel.findById(id).lean<SubscriptionPlanDoc>();
  if (!p) notFound();

  const initial = {
    name: String(p.name ?? ''),
    interval: (p.interval as 'month' | 'year' | 'lifetime') ?? 'year',
    basePriceCents: Number(p.basePriceCents ?? 0),
    additionalUserPriceCents: Number(p.additionalUserPriceCents ?? 0),
    includedUsers: Number(p.includedUsers ?? 1),
    description: String(p.description ?? ''),
    badge: String(p.badge ?? ''),
    maxSubscriptionSlots: Number(p.maxSubscriptionSlots ?? 0),
    trialDays: Number(p.trialDays ?? 0),
    yearlyOffer: {
      enabled: Boolean(p.yearlyOffer?.enabled),
      basePriceCents: Number(p.yearlyOffer?.basePriceCents ?? 0),
      additionalUserPriceCents: Number(p.yearlyOffer?.additionalUserPriceCents ?? 0),
    },
    onboardingCallsEnabled: Boolean(p.onboardingCallsEnabled),
  };

  const backHref = p.archived ? '/admin/plans' : '/admin/plans';

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-[100px] py-8">
      <div className="space-y-6">
        <Link
          href={backHref}
          className="text-sm text-text-secondary underline underline-offset-4 hover:text-text-primary"
        >
          ← Plans
        </Link>
        <AdminPlanForm
          mode="edit"
          planId={id}
          initial={initial}
          stripeProductId={String(p.stripeProductId ?? '')}
        />
      </div>
    </div>
  );
}
