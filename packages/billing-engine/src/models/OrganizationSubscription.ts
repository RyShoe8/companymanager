import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const OrganizationSubscriptionSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    subscriptionPlanId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true, index: true },
    stripeCustomerId: { type: String, default: '' },
    stripeSubscriptionId: { type: String, default: '', index: true },
    /** Stripe subscription item id for the recurring seat line (Phase 2+) */
    stripeSeatItemId: { type: String, default: '' },
    /** Stripe subscription item id for the base recurring line */
    stripeBaseItemId: { type: String, default: '' },
    status: {
      type: String,
      enum: ['trialing', 'active', 'past_due', 'canceled', 'incomplete'],
      default: 'incomplete',
      index: true,
    },
    seats: { type: Number, default: 1, min: 1 },
    startedAt: { type: Date },
    renewsAt: { type: Date },
    /** True when Stripe cancel_at_period_end is set; access continues until renewsAt. */
    cancelAtPeriodEnd: { type: Boolean, default: false },
    grandfathered: { type: Boolean, default: false },
    trialEndsAt: { type: Date },
    billingInterval: { type: String, enum: ['month', 'year'], default: 'month' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

OrganizationSubscriptionSchema.index({ organizationId: 1 }, { unique: true });

export type OrganizationSubscriptionDoc = InferSchemaType<typeof OrganizationSubscriptionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const OrganizationSubscriptionModel: mongoose.Model<OrganizationSubscriptionDoc> =
  (mongoose.models.OrganizationSubscription as mongoose.Model<OrganizationSubscriptionDoc> | undefined) ??
  mongoose.model<OrganizationSubscriptionDoc>('OrganizationSubscription', OrganizationSubscriptionSchema);
