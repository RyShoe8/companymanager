import type Stripe from 'stripe';
import type { OrganizationBillingFields } from '../types';

export type OrganizationSubscriptionStatus = NonNullable<
  OrganizationBillingFields['subscriptionStatus']
>;

export function stripeBillingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function isActiveSubscriptionStatus(
  status: OrganizationSubscriptionStatus | string | null | undefined
): boolean {
  return status === 'active' || status === 'trialing';
}

export function isOrganizationPaid(
  org: { subscriptionStatus?: string | null } | null | undefined
): boolean {
  if (!org) return false;
  if (!stripeBillingEnabled()) return true;
  return isActiveSubscriptionStatus(org.subscriptionStatus);
}

/** Legacy org.plan slug from Stripe subscription status (paid statuses only). */
export function organizationPlanForStripeStatus(status: Stripe.Subscription.Status): string {
  if (status === 'active' || status === 'trialing') return 'pro';
  return 'none';
}

export function mapSubscriptionStatus(
  status: Stripe.Subscription.Status
): OrganizationSubscriptionStatus | 'none' {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
      return 'canceled';
    default:
      return 'incomplete';
  }
}

export function mapOrgSubStatus(
  status: Stripe.Subscription.Status
): 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
      return 'canceled';
    default:
      return 'incomplete';
  }
}

export type OrganizationSubscriptionAccess = {
  isPaid: boolean;
  canServeSignatures: boolean;
  canExportSignatures: boolean;
};

export function getOrganizationSubscriptionAccess(
  org: Pick<OrganizationBillingFields, 'subscriptionStatus'> | null | undefined
): OrganizationSubscriptionAccess {
  const isPaid = isOrganizationPaid(org);
  return {
    isPaid,
    canServeSignatures: isPaid,
    canExportSignatures: isPaid,
  };
}
