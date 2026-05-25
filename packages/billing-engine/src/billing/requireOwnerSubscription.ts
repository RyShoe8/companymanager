import { connectBillingDb, getBillingContext, getOrganizationModel } from '../context';
import type { OrganizationBillingFields, OwnerOrgContext } from '../types';

export type { OwnerOrgContext };

export async function requireOwnerBilling(): Promise<
  | { ok: true; ctx: OwnerOrgContext }
  | { ok: false; status: number; error: string }
> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { ok: false, status: 503, error: 'Stripe not configured' };
  }

  const session = await getBillingContext().auth.getSession();
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const user = session.user;
  if (user.role !== 'owner') {
    return { ok: false, status: 403, error: 'Only the organization owner can manage billing' };
  }
  if (!user.organizationId) {
    return { ok: false, status: 400, error: 'No organization' };
  }

  await connectBillingDb();
  const OrganizationModel = getOrganizationModel();
  const org = await OrganizationModel.findById(user.organizationId);
  if (!org) {
    return { ok: false, status: 404, error: 'Organization not found' };
  }

  return {
    ok: true,
    ctx: {
      userId: user.id,
      organizationId: user.organizationId,
      org: org as OrganizationBillingFields,
    },
  };
}

export async function requireOwnerWithStripeSubscription(): Promise<
  | { ok: true; ctx: OwnerOrgContext }
  | { ok: false; status: number; error: string }
> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { ok: false, status: 503, error: 'Stripe not configured' };
  }

  const session = await getBillingContext().auth.getSession();
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const user = session.user;
  if (user.role !== 'owner') {
    return { ok: false, status: 403, error: 'Only the organization owner can manage billing' };
  }
  if (!user.organizationId) {
    return { ok: false, status: 400, error: 'No organization' };
  }

  await connectBillingDb();
  const OrganizationModel = getOrganizationModel();
  const org = await OrganizationModel.findById(user.organizationId);
  if (!org) {
    return { ok: false, status: 404, error: 'Organization not found' };
  }
  if (!org.stripeSubscriptionId?.trim()) {
    return { ok: false, status: 400, error: 'No active subscription to manage' };
  }

  return {
    ok: true,
    ctx: {
      userId: user.id,
      organizationId: user.organizationId,
      org: org as OrganizationBillingFields,
    },
  };
}
