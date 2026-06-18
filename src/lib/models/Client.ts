import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type ClientStatus = 'active' | 'inactive' | 'lead';

export interface IClient extends Document {
  organizationId: Types.ObjectId;
  userIds: Types.ObjectId[]; // Users who can access this client (e.g. external client users)
  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  domain?: string;
  logo?: string;
  color: string;
  status: ClientStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema: Schema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    name: {
      type: String,
      required: true,
      trim: true,
    },
    contactName: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    domain: {
      type: String,
      trim: true,
      lowercase: true,
    },
    logo: {
      type: String,
      trim: true,
    },
    color: {
      type: String,
      default: '#3b82f6', // Default blue
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'lead'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookup
ClientSchema.index({ organizationId: 1, name: 1 });

const Client: Model<IClient> =
  mongoose.models.Client || mongoose.model<IClient>('Client', ClientSchema);

export default Client;
