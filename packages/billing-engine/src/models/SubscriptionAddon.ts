import mongoose, { Schema, type InferSchemaType } from 'mongoose';

/** Optional add-on products (Phase 4); Stripe price id after sync. */
const SubscriptionAddonSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    interval: { type: String, enum: ['month', 'year', 'one_time'], required: true },
    priceCents: { type: Number, required: true, min: 0 },
    stripeProductId: { type: String, default: '' },
    stripePriceId: { type: String, default: '' },
    active: { type: Boolean, default: true },
    description: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

export type SubscriptionAddonDoc = InferSchemaType<typeof SubscriptionAddonSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SubscriptionAddonModel: mongoose.Model<SubscriptionAddonDoc> =
  (mongoose.models.SubscriptionAddon as mongoose.Model<SubscriptionAddonDoc> | undefined) ??
  mongoose.model<SubscriptionAddonDoc>('SubscriptionAddon', SubscriptionAddonSchema);
