import type mongoose from 'mongoose';
import type { Model } from 'mongoose';

/** Legacy billing fields mirrored on the host Organization document. */
export type OrganizationBillingFields = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  companyName?: string;
  plan?: string;
  subscriptionStatus?: string | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
};

export type BillingSession = {
  user: {
    id: string;
    email?: string | null;
    organizationId?: string;
    role?: string;
  };
};

export type OwnerOrgContext = {
  userId: string;
  organizationId: string;
  org: OrganizationBillingFields;
};

export type BillingNotificationType = 'payment_failed' | 'subscription_canceled';

export type BillingNotificationInput = {
  organizationId: string;
  type: BillingNotificationType;
  stripeEventId: string;
  orgName: string;
  ownerEmail: string;
  billingUrl: string;
};

export type BillingEngineConfig = {
  connect: () => Promise<void>;

  organization: {
    model: Model<OrganizationBillingFields>;
  };

  seats: {
    getSeatCount: (organizationId: string) => Promise<number>;
    beforeCountSeats?: (organizationId: string) => Promise<void>;
  };

  auth: {
    getSession: () => Promise<BillingSession | null>;
    requirePlatformAdmin: () => Promise<Response | null>;
  };

  billing: {
    getAppBaseUrl: () => string;
    notify: (input: BillingNotificationInput) => Promise<void>;
    getOwnerEmailForOrganization: (organizationId: string) => Promise<string | null>;
    /** Optional marketing bullets appended on pricing cards. */
    planFeatureBullets?: readonly string[];
  };

  stripe?: {
    legacyPriceIds?: { basic?: string; pro?: string };
  };

  /** Validate Mongo ObjectId strings (e.g. webhook metadata). */
  isValidObjectId?: (id: string) => boolean;
};
