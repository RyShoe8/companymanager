import type Stripe from 'stripe';
import type { OrganizationBillingFields } from '../types';
import { OrganizationSubscriptionModel } from '../models/OrganizationSubscription';
import type { SubscriptionPlanDoc } from '../models/SubscriptionPlan';
import { getOrganizationModel } from '../context';
import { isValidObjectIdString } from '../utils/objectId';

const PRIOR_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'canceled',
]);

export function getPlanTrialDays(plan: Pick<SubscriptionPlanDoc, 'trialDays' | 'interval'>): number {
  if (plan.interval === 'lifetime') return 0;
  const days = Number(plan.trialDays ?? 0);
  if (!Number.isFinite(days) || days <= 0) return 0;
  return Math.min(365, Math.floor(days));
}

export function trialEndsAtFromStripeSub(sub: Pick<Stripe.Subscription, 'trial_end'>): Date | undefined {
  if (typeof sub.trial_end !== 'number' || sub.trial_end <= 0) return undefined;
  return new Date(sub.trial_end * 1000);
}

export function isCheckoutSessionPaymentComplete(
  session: Pick<Stripe.Checkout.Session, 'mode' | 'payment_status'>
): boolean {
  if (session.payment_status === 'paid') return true;
  if (session.mode === 'subscription' && session.payment_status === 'no_payment_required') {
    return true;
  }
  return false;
}

/**
 * Trial applies only on first Stripe subscription Checkout for an org (not plan changes or seat adds).
 */
export async function shouldApplyPlanTrialAtCheckout(
  orgId: string,
  plan: SubscriptionPlanDoc,
  org?: Pick<OrganizationBillingFields, 'stripeSubscriptionId'> | null
): Promise<boolean> {
  const trialDays = getPlanTrialDays(plan);
  if (trialDays <= 0) return false;
  if (!isValidObjectIdString(orgId)) return false;

  const OrganizationModel = getOrganizationModel();
  const orgDoc =
    org ??
    (await OrganizationModel.findById(orgId)
      .select('stripeSubscriptionId')
      .lean<Pick<OrganizationBillingFields, 'stripeSubscriptionId'>>());

  if (orgDoc?.stripeSubscriptionId?.trim()) return false;

  const orgSub = await OrganizationSubscriptionModel.findOne({ organizationId: orgId })
    .select('status startedAt stripeSubscriptionId')
    .lean<{
      status?: string;
      startedAt?: Date;
      stripeSubscriptionId?: string;
    }>();

  if (orgSub?.startedAt) return false;
  if (orgSub?.stripeSubscriptionId?.trim()) return false;
  if (orgSub?.status && PRIOR_SUBSCRIPTION_STATUSES.has(orgSub.status)) return false;

  return true;
}

export function checkoutTrialPeriodDays(plan: SubscriptionPlanDoc): number | undefined {
  const days = getPlanTrialDays(plan);
  return days > 0 ? days : undefined;
}
