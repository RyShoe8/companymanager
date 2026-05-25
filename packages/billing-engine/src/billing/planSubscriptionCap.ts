import mongoose from 'mongoose';
import { OrganizationSubscriptionModel } from '../models/OrganizationSubscription';
import type { SubscriptionPlanDoc } from '../models/SubscriptionPlan';

export type PlanCapUsage = {
  used: number;
  max: number;
  unlimited: boolean;
  remaining: number | null;
  soldOut: boolean;
};

export class PlanSubscriptionCapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanSubscriptionCapError';
  }
}

/** Promo-style: every org sub row for this plan id counts (all statuses, including canceled/incomplete). */
export async function countOrganizationSubscriptionsForPlan(
  subscriptionPlanId: string | mongoose.Types.ObjectId
): Promise<number> {
  const planId =
    typeof subscriptionPlanId === 'string'
      ? new mongoose.Types.ObjectId(subscriptionPlanId)
      : subscriptionPlanId;
  return OrganizationSubscriptionModel.countDocuments({ subscriptionPlanId: planId });
}

export async function orgHasSubscriptionForPlan(
  organizationId: string | mongoose.Types.ObjectId,
  subscriptionPlanId: string | mongoose.Types.ObjectId
): Promise<boolean> {
  const orgId =
    typeof organizationId === 'string' ? new mongoose.Types.ObjectId(organizationId) : organizationId;
  const planId =
    typeof subscriptionPlanId === 'string'
      ? new mongoose.Types.ObjectId(subscriptionPlanId)
      : subscriptionPlanId;
  const exists = await OrganizationSubscriptionModel.exists({
    organizationId: orgId,
    subscriptionPlanId: planId,
  });
  return Boolean(exists);
}

export async function getPlanSubscriptionCapUsage(
  plan: Pick<SubscriptionPlanDoc, '_id' | 'maxSubscriptionSlots'>
): Promise<PlanCapUsage> {
  const used = await countOrganizationSubscriptionsForPlan(plan._id);
  const max = Number(plan.maxSubscriptionSlots ?? 0);
  const unlimited = max === 0;
  const remaining = unlimited ? null : Math.max(0, max - used);
  const soldOut = !unlimited && used >= max;
  return { used, max, unlimited, remaining, soldOut };
}

/** Throws PlanSubscriptionCapError when no slot available for a new org. */
export async function assertPlanHasSubscriptionSlot(
  plan: Pick<SubscriptionPlanDoc, '_id' | 'maxSubscriptionSlots'>,
  organizationId?: string | mongoose.Types.ObjectId
): Promise<void> {
  const max = Number(plan.maxSubscriptionSlots ?? 0);
  if (max === 0) return;

  if (organizationId) {
    const already = await orgHasSubscriptionForPlan(organizationId, plan._id);
    if (already) return;
  }

  const { soldOut } = await getPlanSubscriptionCapUsage(plan);
  if (soldOut) {
    throw new PlanSubscriptionCapError(
      'This plan is no longer available (subscription limit reached).'
    );
  }
}

export function isPlanOfferable(
  plan: Pick<SubscriptionPlanDoc, 'active' | 'paused' | 'archived'>
): boolean {
  return Boolean(plan.active) && !plan.paused && !plan.archived;
}
