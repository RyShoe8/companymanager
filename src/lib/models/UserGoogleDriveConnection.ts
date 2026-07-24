import mongoose, { Schema, Document, Model, Types } from 'mongoose';

interface IUserGoogleDriveConnection extends Document {
  userId: Types.ObjectId;
  provider: 'google';
  refreshTokenEncrypted: string;
  connectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserGoogleDriveConnectionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    provider: { type: String, enum: ['google'], required: true, default: 'google' },
    refreshTokenEncrypted: { type: String, required: true },
    connectedAt: { type: Date },
  },
  { timestamps: true }
);

const UserGoogleDriveConnection: Model<IUserGoogleDriveConnection> =
  mongoose.models.UserGoogleDriveConnection ||
  mongoose.model<IUserGoogleDriveConnection>(
    'UserGoogleDriveConnection',
    UserGoogleDriveConnectionSchema
  );

export default UserGoogleDriveConnection;
