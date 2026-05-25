import mongoose, { Schema, type InferSchemaType } from 'mongoose';

/** Canonical plan definition; Stripe products/prices are derived via sync. Amounts in USD cents. */
const SubscriptionPlanSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    active: { type: Boolean, default: true, index: true },
    paused: { type: Boolean, default: false, index: true },
    interval: { type: String, enum: ['month', 'year', 'lifetime'], required: true },
    basePriceCents: { type: Number, required: true, min: 0 },
    additionalUserPriceCents: { type: Number, default: 0, min: 0 },
    includedUsers: { type: Number, default: 1, min: 1 },
    description: { type: String, default: '' },
    badge: { type: String, default: '' },
    stripeProductId: { type: String, default: '' },
    stripeBasePriceId: { type: String, default: '' },
    stripeSeatPriceId: { type: String, default: '' },
    version: { type: Number, default: 1, min: 1 },
    /** Max org subscriptions for this plan document; 0 = unlimited */
    maxSubscriptionSlots: { type: Number, default: 0, min: 0 },
    /** Retired from public catalog; existing subs stay pinned */
    archived: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

SubscriptionPlanSchema.index({ slug: 1, version: 1 }, { unique: true });

export type SubscriptionPlanDoc = InferSchemaType<typeof SubscriptionPlanSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SubscriptionPlanModel: mongoose.Model<SubscriptionPlanDoc> =
  (mongoose.models.SubscriptionPlan as mongoose.Model<SubscriptionPlanDoc> | undefined) ??
  mongoose.model<SubscriptionPlanDoc>('SubscriptionPlan', SubscriptionPlanSchema);
