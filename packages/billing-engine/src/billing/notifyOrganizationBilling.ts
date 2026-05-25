import mongoose from 'mongoose';
import { connectBillingDb, getBillingContext, getOrganizationModel } from '../context';
import { BillingNotificationModel } from '../models/BillingNotification';
import type { BillingNotificationType } from '../types';

export type { BillingNotificationType };

async function recordNotificationIfNew(
  stripeEventId: string,
  organizationId: mongoose.Types.ObjectId,
  type: BillingNotificationType
): Promise<boolean> {
  try {
    await BillingNotificationModel.create({ stripeEventId, organizationId, type });
    return true;
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: number }).code === 11000) {
      return false;
    }
    throw e;
  }
}

export async function notifyOrganizationBilling(
  organizationId: string | mongoose.Types.ObjectId,
  type: BillingNotificationType,
  stripeEventId: string
): Promise<void> {
  await connectBillingDb();
  const ctx = getBillingContext();
  const orgObjId =
    typeof organizationId === 'string' ? new mongoose.Types.ObjectId(organizationId) : organizationId;

  const shouldSend = await recordNotificationIfNew(stripeEventId, orgObjId, type);
  if (!shouldSend) return;

  const OrganizationModel = getOrganizationModel();
  const org = await OrganizationModel.findById(orgObjId).select('name companyName').lean<{
    name?: string;
    companyName?: string;
  }>();
  if (!org) return;

  const ownerEmail = await ctx.billing.getOwnerEmailForOrganization(orgObjId.toString());
  if (!ownerEmail) {
    console.warn('[billing notify] No owner email for org', orgObjId.toString());
    return;
  }

  const orgName = (org.companyName || org.name || 'your organization').trim();
  const billingUrl = `${ctx.billing.getAppBaseUrl()}/dashboard/billing`;

  await ctx.billing.notify({
    organizationId: orgObjId.toString(),
    type,
    stripeEventId,
    orgName,
    ownerEmail,
    billingUrl,
  });
}
