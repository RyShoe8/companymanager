import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const StripeWebhookEventSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true },
    processedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false }
);

export type StripeWebhookEventDoc = InferSchemaType<typeof StripeWebhookEventSchema>;

export const StripeWebhookEventModel =
  mongoose.models.StripeWebhookEvent ??
  mongoose.model('StripeWebhookEvent', StripeWebhookEventSchema);
