import { NextResponse } from 'next/server';
import type { OrganizationBillingFields } from '../types';
import { SubscriptionPlanModel, type SubscriptionPlanDoc } from '../models/SubscriptionPlan';
import { getStripe } from '../stripe/client';
import { getStripePriceIds } from '../stripe/config';
import { isValidObjectIdString } from '../utils/objectId';
import { getEffectiveSeatCount } from './employeeLimits';
import {
  assertPlanHasSubscriptionSlot,
  isPlanOfferable,
  PlanSubscriptionCapError,
} from './planSubscriptionCap';
import { getBillingContext } from '../context';

export class CheckoutSessionError extends Error {
  constructor(
    message: string,
    public status: number = 400
  ) {
    super(message);
    this.name = 'CheckoutSessionError';
  }
}

export async function validatePlanForCheckout(
  dbPlan: SubscriptionPlanDoc,
  organizationId?: string
): Promise<void> {
  if (!isPlanOfferable(dbPlan)) {
    throw new CheckoutSessionError('Plan not available', 400);
  }
  if (!dbPlan.stripeBasePriceId) {
    throw new CheckoutSessionError('Plan not synced to Stripe yet', 400);
  }
  try {
    await assertPlanHasSubscriptionSlot(dbPlan, organizationId);
  } catch (e) {
    if (e instanceof PlanSubscriptionCapError) {
      throw new CheckoutSessionError(e.message, 409);
    }
    throw e;
  }
}

export type CreateCheckoutSessionInput = {
  org: Pick<OrganizationBillingFields, '_id' | 'stripeCustomerId'>;
  userEmail?: string | null;
  subscriptionPlanId?: string;
  planSlug?: 'basic' | 'pro';
  successUrl?: string;
  cancelUrl?: string;
};

export async function createCheckoutSessionForOrganization(
  input: CreateCheckoutSessionInput
): Promise<{ url: string }> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new CheckoutSessionError('Billing is not configured', 503);
  }

  const ctx = getBillingContext();
  const base = ctx.billing.getAppBaseUrl();
  const successUrl = input.successUrl ?? `${base}/dashboard/billing?checkout=success`;
  const cancelUrl = input.cancelUrl ?? `${base}/dashboard/billing`;

  const orgId = input.org._id.toString();
  let priceId = '';
  let checkoutMode: 'subscription' | 'payment' = 'subscription';
  let subscriptionPlanIdMeta = '';
  let dbPlanForSeats: SubscriptionPlanDoc | null = null;
  const stripePriceIds = getStripePriceIds();

  if (input.subscriptionPlanId?.trim()) {
    const pid = input.subscriptionPlanId.trim();
    if (!isValidObjectIdString(pid)) {
      throw new CheckoutSessionError('Invalid subscriptionPlanId', 400);
    }
    const dbPlan = await SubscriptionPlanModel.findById(pid).lean<SubscriptionPlanDoc>();
    if (!dbPlan) {
      throw new CheckoutSessionError('Plan not found', 404);
    }
    await validatePlanForCheckout(dbPlan, orgId);

    priceId = dbPlan.stripeBasePriceId;
    subscriptionPlanIdMeta = String(dbPlan._id);
    checkoutMode = dbPlan.interval === 'lifetime' ? 'payment' : 'subscription';
    dbPlanForSeats = dbPlan;
  } else if (input.planSlug) {
    const slugPlan = await SubscriptionPlanModel.findOne({
      slug: input.planSlug,
      active: true,
      paused: false,
      archived: false,
      stripeBasePriceId: { $exists: true, $nin: ['', null] },
    })
      .sort({ version: -1 })
      .lean<SubscriptionPlanDoc>();

    if (slugPlan?.stripeBasePriceId) {
      await validatePlanForCheckout(slugPlan, orgId);
      priceId = slugPlan.stripeBasePriceId;
      subscriptionPlanIdMeta = String(slugPlan._id);
      checkoutMode = slugPlan.interval === 'lifetime' ? 'payment' : 'subscription';
      dbPlanForSeats = slugPlan;
    } else {
      priceId = input.planSlug === 'pro' ? stripePriceIds.pro : stripePriceIds.basic;
      if (!priceId) {
        throw new CheckoutSessionError(
          'Missing STRIPE_BASIC_PRICE_ID or STRIPE_PRO_PRICE_ID',
          500
        );
      }
    }
  } else {
    throw new CheckoutSessionError('Provide plan (basic|pro) or subscriptionPlanId', 400);
  }

  const stripe = getStripe();
  const meta: Record<string, string> = { organizationId: orgId };
  if (subscriptionPlanIdMeta) meta.subscriptionPlanId = subscriptionPlanIdMeta;

  const lineItems: import('stripe').Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: priceId, quantity: 1 },
  ];
  if (
    checkoutMode === 'subscription' &&
    dbPlanForSeats?.stripeSeatPriceId &&
    dbPlanForSeats.additionalUserPriceCents > 0
  ) {
    if (ctx.seats.beforeCountSeats) {
      await ctx.seats.beforeCountSeats(orgId);
    }
    const cnt = getEffectiveSeatCount(await ctx.seats.getSeatCount(orgId));
    const extra = Math.max(0, cnt - (dbPlanForSeats.includedUsers ?? 1));
    if (extra > 0) {
      lineItems.push({ price: dbPlanForSeats.stripeSeatPriceId, quantity: extra });
    }
  }

  const params: import('stripe').Stripe.Checkout.SessionCreateParams = {
    mode: checkoutMode,
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: meta,
  };

  if (checkoutMode === 'subscription') {
    params.subscription_data = { metadata: meta };
  }

  if (input.org.stripeCustomerId) {
    params.customer = input.org.stripeCustomerId;
  } else if (input.userEmail) {
    params.customer_email = input.userEmail;
  }

  const checkout = await stripe.checkout.sessions.create(params);
  if (!checkout.url) {
    throw new CheckoutSessionError('No checkout URL', 500);
  }

  return { url: checkout.url };
}

export function checkoutErrorToResponse(err: unknown): NextResponse {
  if (err instanceof CheckoutSessionError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error('[checkout]', err);
  return NextResponse.json({ error: 'Could not start checkout' }, { status: 500 });
}
