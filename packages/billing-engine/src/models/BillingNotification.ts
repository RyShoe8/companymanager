import mongoose, { Schema, type InferSchemaType } from 'mongoose';

/** Idempotent log of billing emails sent for a Stripe webhook event. */
const BillingNotificationSchema = new Schema(
  {
    stripeEventId: { type: String, required: true, unique: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    type: {
      type: String,
      enum: ['payment_failed', 'subscription_canceled'],
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type BillingNotificationDoc = InferSchemaType<typeof BillingNotificationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const BillingNotificationModel: mongoose.Model<BillingNotificationDoc> =
  (mongoose.models.BillingNotification as mongoose.Model<BillingNotificationDoc> | undefined) ??
  mongoose.model<BillingNotificationDoc>('BillingNotification', BillingNotificationSchema);
