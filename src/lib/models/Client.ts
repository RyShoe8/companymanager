import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import {
  type IPlatformOperationsFields,
  platformOperationsSchemaFields,
} from '@/lib/models/platformFields';

export type ClientStatus = 'active' | 'inactive' | 'lead';

export interface IClient extends Document, IPlatformOperationsFields {
  organizationId: Types.ObjectId;
  userIds: Types.ObjectId[];
  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  domain?: string;
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
      default: '#3b82f6',
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'lead'],
      default: 'active',
    },
    ...platformOperationsSchemaFields,
  },
  {
    timestamps: true,
  }
);

ClientSchema.index({ organizationId: 1, name: 1 });
ClientSchema.index({ clientPortalSlug: 1 }, { sparse: true });
ClientSchema.index({ 'techStack.technologyId': 1 });
ClientSchema.index({ 'marketingStack.toolId': 1 });

const Client: Model<IClient> =
  mongoose.models.Client || mongoose.model<IClient>('Client', ClientSchema);

export default Client;
