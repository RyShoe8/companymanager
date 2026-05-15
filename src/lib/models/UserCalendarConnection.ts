import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IUserCalendarConnection extends Document {
  userId: Types.ObjectId;
  provider: 'google';
  refreshTokenEncrypted: string;
  calendarId: string;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserCalendarConnectionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    provider: { type: String, enum: ['google'], required: true, default: 'google' },
    refreshTokenEncrypted: { type: String, required: true },
    calendarId: { type: String, default: 'primary' },
    syncedAt: { type: Date },
  },
  { timestamps: true }
);

const UserCalendarConnection: Model<IUserCalendarConnection> =
  mongoose.models.UserCalendarConnection ||
  mongoose.model<IUserCalendarConnection>('UserCalendarConnection', UserCalendarConnectionSchema);

export default UserCalendarConnection;
