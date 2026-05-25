import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import mongoose from 'mongoose';
import { getStripe } from '../../stripe/client';
import { connectBillingDb, getBillingContext, getOrganizationModel } from '../../context';
import { OrganizationSubscriptionModel } from '../../models/OrganizationSubscription';
import { SubscriptionPlanModel, type SubscriptionPlanDoc } from '../../models/SubscriptionPlan';
import { StripeWebhookEventModel } from '../../models/StripeWebhookEvent';
import { getEffectiveSeatCount } from '../../billing/employeeLimits';
import { validObjectId } from '../../utils/validObjectId';
import { persistOrganizationSubscriptionStripeItems } from '../../stripe/subscriptionItemSync';
import { syncStripeSubscriptionSeatsForOrganization } from '../../stripe/syncSubscriptionSeats';
import {
  isActiveSubscriptionStatus,
  mapOrgSubStatus,
  mapSubscriptionStatus,
  organizationPlanForStripeStatus,
} from '../../billing/subscriptionAccess';
import { notifyOrganizationBilling } from '../../billing/notifyOrganizationBilling';

async function resolveSubscriptionPlanMongoId(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<string | null> {
  const mid = session.metadata?.subscriptionPlanId;
  if (mid && validObjectId(mid)) return mid;
  if (session.mode === 'subscription' && session.subscription) {
    const sub = await stripe.subscriptions.retrieve(String(session.subscription), {
      expand: ['items.data.price'],
    });
    const priceId = sub.items.data[0]?.price?.id;
    if (!priceId) return null;
    const plan = await SubscriptionPlanModel.findOne({ stripeBasePriceId: priceId, active: true })
      .sort({ version: -1 })
      .select('_id')
      .lean();
    return plan ? String(plan._id) : null;
  }
  if (session.mode === 'payment') {
    const cs = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items.data.price'],
    });
    const pid = cs.line_items?.data[0]?.price?.id;
    if (!pid) return null;
    const plan = await SubscriptionPlanModel.findOne({ stripeBasePriceId: pid, active: true })
      .sort({ version: -1 })
      .select('_id')
      .lean();
    return plan ? String(plan._id) : null;
  }
  return null;
}

async function resolvePlanSlugForSubscription(stripeSubscriptionId: string): Promise<string> {
  const orgSub = await OrganizationSubscriptionModel.findOne({ stripeSubscriptionId })
    .populate<{ subscriptionPlanId: SubscriptionPlanDoc | null }>('subscriptionPlanId')
    .lean();
  const slug = orgSub?.subscriptionPlanId?.slug;
  if (slug && slug !== 'none') return String(slug);
  return 'pro';
}

async function syncActiveSubscriptionItems(
  orgObjId: mongoose.Types.ObjectId,
  sub: Stripe.Subscription,
  planDoc: SubscriptionPlanDoc
): Promise<void> {
  if (!isActiveSubscriptionStatus(mapOrgSubStatus(sub.status))) return;
  await persistOrganizationSubscriptionStripeItems(orgObjId, sub, planDoc);
  await syncStripeSubscriptionSeatsForOrganization(orgObjId);
}

async function seatCountForOrg(orgId: string): Promise<number> {
  const ctx = getBillingContext();
  if (ctx.seats.beforeCountSeats) {
    await ctx.seats.beforeCountSeats(orgId);
  }
  return getEffectiveSeatCount(await ctx.seats.getSeatCount(orgId));
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  await connectBillingDb();
  const OrganizationModel = getOrganizationModel();

  const existing = await StripeWebhookEventModel.findOne({ eventId: event.id });
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.organizationId;
        if (!orgId || !session.customer || !validObjectId(orgId)) break;
        if (session.payment_status !== 'paid') break;

        const customerId = String(session.customer);
        const planDocId = await resolveSubscriptionPlanMongoId(stripe, session);

        if (session.mode === 'subscription' && session.subscription) {
          const subId = String(session.subscription);
          const sub = await stripe.subscriptions.retrieve(subId, { expand: ['items.data.price'] });
          const subscriptionStatus = mapSubscriptionStatus(sub.status);
          const planSlug = planDocId
            ? (
                await SubscriptionPlanModel.findById(planDocId).select('slug').lean<{ slug?: string }>()
              )?.slug ?? 'pro'
            : organizationPlanForStripeStatus(sub.status);

          await OrganizationModel.findByIdAndUpdate(orgId, {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subId,
            subscriptionStatus,
            plan: planSlug,
          });

          if (planDocId) {
            const orgObjId = new mongoose.Types.ObjectId(orgId);
            const planObjId = new mongoose.Types.ObjectId(planDocId);
            const plan = await SubscriptionPlanModel.findById(planObjId).lean();
            const count = await seatCountForOrg(orgId);
            const renewsAt =
              typeof sub.current_period_end === 'number'
                ? new Date(sub.current_period_end * 1000)
                : undefined;

            await OrganizationSubscriptionModel.findOneAndUpdate(
              { organizationId: orgObjId },
              {
                $set: {
                  subscriptionPlanId: planObjId,
                  stripeCustomerId: customerId,
                  stripeSubscriptionId: subId,
                  status: mapOrgSubStatus(sub.status),
                  seats: count,
                  startedAt: new Date(),
                  renewsAt,
                  cancelAtPeriodEnd: sub.cancel_at_period_end === true,
                },
              },
              { upsert: true }
            );
            if (plan) {
              await syncActiveSubscriptionItems(orgObjId, sub, plan);
            }
          }
        } else if (session.mode === 'payment') {
          const planSlug = planDocId
            ? (
                await SubscriptionPlanModel.findById(planDocId).select('slug').lean<{ slug?: string }>()
              )?.slug ?? 'pro'
            : 'pro';

          await OrganizationModel.findByIdAndUpdate(orgId, {
            stripeCustomerId: customerId,
            stripeSubscriptionId: '',
            subscriptionStatus: 'active',
            plan: planSlug,
          });
          if (planDocId) {
            const orgObjId = new mongoose.Types.ObjectId(orgId);
            const planObjId = new mongoose.Types.ObjectId(planDocId);
            const count = await seatCountForOrg(orgId);
            await OrganizationSubscriptionModel.findOneAndUpdate(
              { organizationId: orgObjId },
              {
                $set: {
                  subscriptionPlanId: planObjId,
                  stripeCustomerId: customerId,
                  stripeSubscriptionId: '',
                  status: 'active',
                  seats: count,
                  stripeBaseItemId: '',
                  stripeSeatItemId: '',
                  startedAt: new Date(),
                },
              },
              { upsert: true }
            );
          }
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.organizationId;
        const isDeleted = event.type === 'customer.subscription.deleted';
        const subscriptionStatus = isDeleted ? 'canceled' : mapSubscriptionStatus(sub.status);
        const planSlug = isDeleted ? 'none' : organizationPlanForStripeStatus(sub.status);

        const patch: Record<string, unknown> = {
          stripeSubscriptionId: isDeleted ? '' : sub.id,
          stripeCustomerId: String(sub.customer),
          subscriptionStatus,
          plan: planSlug,
        };

        let resolvedOrgId: string | null = orgId && validObjectId(orgId) ? orgId : null;

        if (resolvedOrgId) {
          await OrganizationModel.findByIdAndUpdate(resolvedOrgId, patch);
        } else if (sub.customer) {
          const updated = await OrganizationModel.findOneAndUpdate(
            { stripeCustomerId: String(sub.customer) },
            patch,
            { new: true }
          )
            .select('_id')
            .lean<{ _id: mongoose.Types.ObjectId }>();
          resolvedOrgId = updated ? String(updated._id) : null;
        }

        const orgSubStatus = isDeleted ? 'canceled' : mapOrgSubStatus(sub.status);
        const orgSubPatch: Record<string, unknown> = {
          status: orgSubStatus,
          stripeCustomerId: String(sub.customer),
          cancelAtPeriodEnd: isDeleted ? false : sub.cancel_at_period_end === true,
        };
        if (typeof sub.current_period_end === 'number') {
          orgSubPatch.renewsAt = new Date(sub.current_period_end * 1000);
        }

        const orgSub = await OrganizationSubscriptionModel.findOneAndUpdate(
          { stripeSubscriptionId: sub.id },
          { $set: orgSubPatch },
          { new: true }
        )
          .populate<{ subscriptionPlanId: SubscriptionPlanDoc | null }>('subscriptionPlanId')
          .lean();

        const orgObjId = orgSub
          ? new mongoose.Types.ObjectId(String(orgSub.organizationId))
          : resolvedOrgId
            ? new mongoose.Types.ObjectId(resolvedOrgId)
            : null;

        if (orgSub && !isDeleted) {
          const planDoc = orgSub.subscriptionPlanId;
          if (planDoc && orgObjId) {
            await syncActiveSubscriptionItems(orgObjId, sub, planDoc);
          }
        }

        if (orgObjId && (isDeleted || orgSubStatus === 'canceled')) {
          await notifyOrganizationBilling(orgObjId, 'subscription_canceled', event.id);
        }
        break;
      }
      case 'invoice.paid': {
        const inv = event.data.object as Stripe.Invoice;
        const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
        if (!customerId) break;

        const subRef = inv.subscription;
        const subId = typeof subRef === 'string' ? subRef : subRef?.id;
        const planSlug = subId ? await resolvePlanSlugForSubscription(subId) : 'pro';

        await OrganizationModel.findOneAndUpdate(
          { stripeCustomerId: customerId },
          { subscriptionStatus: 'active', plan: planSlug }
        );

        if (subId) {
          await OrganizationSubscriptionModel.findOneAndUpdate(
            { stripeSubscriptionId: subId },
            { $set: { status: 'active' } }
          );
        }
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
        if (!customerId) break;

        const org = await OrganizationModel.findOneAndUpdate(
          { stripeCustomerId: customerId },
          { subscriptionStatus: 'past_due', plan: 'none' },
          { new: true }
        )
          .select('_id')
          .lean<{ _id: mongoose.Types.ObjectId }>();

        const subRef = inv.subscription;
        const subId = typeof subRef === 'string' ? subRef : subRef?.id;
        if (subId) {
          await OrganizationSubscriptionModel.findOneAndUpdate(
            { stripeSubscriptionId: subId },
            { $set: { status: 'past_due' } }
          );
        }

        if (org) {
          await notifyOrganizationBilling(org._id, 'payment_failed', event.id);
        }
        break;
      }
      default:
        break;
    }

    await StripeWebhookEventModel.create({ eventId: event.id });
  } catch (e) {
    console.error('[stripe webhook]', e);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
