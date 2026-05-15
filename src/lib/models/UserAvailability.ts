import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IAvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface IUserAvailability extends Document {
  userId: Types.ObjectId;
  timezone: string;
  slots: IAvailabilitySlot[];
  updatedAt: Date;
}

const AvailabilitySlotSchema = new Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const UserAvailabilitySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    timezone: { type: String, default: 'America/New_York', trim: true },
    slots: { type: [AvailabilitySlotSchema], default: [] },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

const UserAvailability: Model<IUserAvailability> =
  mongoose.models.UserAvailability ||
  mongoose.model<IUserAvailability>('UserAvailability', UserAvailabilitySchema);

export default UserAvailability;
