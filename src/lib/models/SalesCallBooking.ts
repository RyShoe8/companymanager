import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const SalesCallBookingSchema = new Schema(
  {
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

SalesCallBookingSchema.index(
  { hostId: 1, start: 1 },
  { unique: true, partialFilterExpression: { status: 'scheduled' } }
);

export type SalesCallBookingDoc = InferSchemaType<typeof SalesCallBookingSchema> & {
  _id: mongoose.Types.ObjectId;
};

const SalesCallBookingModel: mongoose.Model<SalesCallBookingDoc> =
  (mongoose.models.SalesCallBooking as mongoose.Model<SalesCallBookingDoc> | undefined) ??
  mongoose.model<SalesCallBookingDoc>('SalesCallBooking', SalesCallBookingSchema);

export default SalesCallBookingModel;
