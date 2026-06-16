import type { PublicPricingPlan } from '../types/publicPricing';
import type { EmployeeLimitInfo } from '../billing/employeeLimits';
import { isActiveSubscriptionStatus, isOrganizationPaid } from '../billing/subscriptionAccess';

export type OrganizationBillingSummary = {
  renewsAt: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  subscriptionStatus: string;
  canCancel: boolean;
  canReactivate: boolean;
  canChangePlan: boolean;
  canAddSeats: boolean;
  addSeatsHref: string | null;
  addSeatsBlockedReason: string | null;
};

type OrgLike = {
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
};

type OrgSubLike = {
  renewsAt?: Date | string | null;
  trialEndsAt?: Date | string | null;
  cancelAtPeriodEnd?: boolean | null;
  status?: string | null;
};

function otherOfferablePlans(
  currentPlan: PublicPricingPlan | null,
  availablePlans: PublicPricingPlan[]
): PublicPricingPlan[] {
  return availablePlans.filter((p) => {
    if (p.soldOut) return false;
    if (!currentPlan) return true;
    return p.id !== currentPlan.id && p.slug !== currentPlan.slug;
  });
}

export function buildOrganizationBillingSummary(
  org: OrgLike | null | undefined,
  orgSub: OrgSubLike | null | undefined,
  viewerRole: string,
  options?: {
    currentPlan?: PublicPricingPlan | null;
    availablePlans?: PublicPricingPlan[];
    seatLimits?: EmployeeLimitInfo | null;
  }
): OrganizationBillingSummary {
  const isOwner = viewerRole === 'owner';
  const hasSubscription = Boolean(org?.stripeSubscriptionId?.trim());
  const active = isActiveSubscriptionStatus(org?.subscriptionStatus);
  const cancelAtPeriodEnd = orgSub?.cancelAtPeriodEnd === true;
  const isPaid = isOrganizationPaid(org);
  const currentPlan = options?.currentPlan ?? null;
  const availablePlans = options?.availablePlans ?? [];
  const seatLimits = options?.seatLimits ?? null;

  let renewsAt: string | null = null;
  if (orgSub?.renewsAt) {
    const d = orgSub.renewsAt instanceof Date ? orgSub.renewsAt : new Date(orgSub.renewsAt);
    if (!Number.isNaN(d.getTime())) renewsAt = d.toISOString();
  }

  let trialEndsAt: string | null = null;
  const isTrialing =
    org?.subscriptionStatus === 'trialing' || orgSub?.status === 'trialing';
  if (isTrialing && orgSub?.trialEndsAt) {
    const d =
      orgSub.trialEndsAt instanceof Date ? orgSub.trialEndsAt : new Date(orgSub.trialEndsAt);
    if (!Number.isNaN(d.getTime())) trialEndsAt = d.toISOString();
  }

  const alternates = otherOfferablePlans(currentPlan, availablePlans);
  const canChangePlan = isOwner && alternates.length > 0;

  let canAddSeats = false;
  let addSeatsHref: string | null = null;
  let addSeatsBlockedReason: string | null = null;

  if (isOwner && isPaid && seatLimits) {
    if (seatLimits.canAddBeyondIncluded && seatLimits.canAddMore) {
      canAddSeats = true;
      addSeatsHref = '/dashboard/employees/new';
    } else if (!seatLimits.canAddBeyondIncluded) {
      const n = seatLimits.includedUsers ?? seatLimits.maxEmployees ?? 1;
      addSeatsBlockedReason = `This plan includes ${n} user${n === 1 ? '' : 's'} only. Change plan to one that supports additional seats.`;
    } else if (!seatLimits.canAddMore && seatLimits.maxEmployees !== null) {
      addSeatsBlockedReason = `All ${seatLimits.maxEmployees} included seats are in use. Change plan to add more users.`;
    }
  }

  return {
    renewsAt,
    trialEndsAt,
    cancelAtPeriodEnd,
    subscriptionStatus: String(org?.subscriptionStatus ?? 'none'),
    canCancel: isOwner && hasSubscription && active && !cancelAtPeriodEnd,
    canReactivate: isOwner && hasSubscription && active && cancelAtPeriodEnd,
    canChangePlan,
    canAddSeats,
    addSeatsHref,
    addSeatsBlockedReason,
  };
}
