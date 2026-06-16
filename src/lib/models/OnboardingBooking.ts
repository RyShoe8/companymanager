import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const OnboardingBookingSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subscriptionPlanId: { type: Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    hostId: { type: String, required: true, trim: true },
    hostEmail: { type: String, required: true, trim: true, lowercase: true },
    hostName: { type: String, default: '', trim: true },
    start: { type: Date, required: true, index: true },
    end: { type: Date, required: true },
    status: { type: String, enum: ['scheduled', 'canceled'], default: 'scheduled', index: true },
    attendeeName: { type: String, required: true, trim: true },
    attendeeEmail: { type: String, required: true, trim: true, lowercase: true },
    calendarInviteSentAt: { type: Date },
  },
  { timestamps: true }
);

OnboardingBookingSchema.index(
  { hostId: 1, start: 1 },
  { unique: true, partialFilterExpression: { status: 'scheduled' } }
);

export type OnboardingBookingDoc = InferSchemaType<typeof OnboardingBookingSchema> & {
  _id: mongoose.Types.ObjectId;
};

const OnboardingBookingModel: mongoose.Model<OnboardingBookingDoc> =
  (mongoose.models.OnboardingBooking as mongoose.Model<OnboardingBookingDoc> | undefined) ??
  mongoose.model<OnboardingBookingDoc>('OnboardingBooking', OnboardingBookingSchema);

export default OnboardingBookingModel;
