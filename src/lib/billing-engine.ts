import { createBillingEngine } from 'billing-engine';
import type { BillingNotificationInput, OrganizationBillingFields } from 'billing-engine';
import mongoose, { type Model } from 'mongoose';
import connectDB from '@/lib/db/mongodb';
import Organization from '@/lib/models/Organization';
import Employee from '@/lib/models/Employee';
import User from '@/lib/models/User';
import { NUCLEAS_PLAN_CARD_BULLETS } from '@/lib/marketing/planCardBullets';
import { sendEmail } from '@/lib/services/email';
import { buildBillingNotificationEmail } from '@/lib/billing/billingEmailTemplates';
import { getBillingSession, requirePlatformAdminApi } from '@/lib/billing/sessionAdapter';
import { getAppBaseUrl } from '@/lib/utils/appBaseUrl';

const NUCLEAS_PLAN_FEATURE_BULLETS = NUCLEAS_PLAN_CARD_BULLETS;

export const billing = createBillingEngine({
  connect: async () => {
    await connectDB();
  },
  organization: {
    model: Organization as unknown as Model<OrganizationBillingFields>,
  },
  seats: {
    async getSeatCount(organizationId) {
      await connectDB();
      const org = await Organization.findById(organizationId);
      if (!org) return 0;
      return Employee.countDocuments({ organizationId: org.userId.toString() });
    },
  },
  auth: {
    getSession: getBillingSession,
    requirePlatformAdmin: requirePlatformAdminApi,
  },
  billing: {
    getAppBaseUrl,
    planFeatureBullets: NUCLEAS_PLAN_FEATURE_BULLETS,
    async getOwnerEmailForOrganization(organizationId) {
      await connectDB();
      const org = await Organization.findById(organizationId);
      if (!org) return null;
      const owner = await User.findById(org.userId);
      return owner?.email?.trim() || null;
    },
    async notify(input: BillingNotificationInput) {
      const content = buildBillingNotificationEmail(input);
      try {
        await sendEmail({
          to: input.ownerEmail,
          subject: content.subject,
          html: content.html,
          text: content.text,
        });
      } catch (error) {
        console.error(
          '[billing notify] send failed',
          input.type,
          input.organizationId,
          error
        );
      }
    },
  },
  isValidObjectId: (id) => mongoose.Types.ObjectId.isValid(id),
});
