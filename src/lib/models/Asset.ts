import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type AssetType = 'spreadsheet' | 'document' | 'tool' | 'folder' | 'link' | 'other';

export interface IAsset extends Document {
  name: string;
  type: AssetType;
  url?: string;
  description?: string;
  category?: string;
  tags: string[];
  linkedProjectId?: Types.ObjectId;
  linkedOperationId?: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AssetSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['spreadsheet', 'document', 'tool', 'folder', 'link', 'other'],
      required: true,
    },
    url: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    linkedProjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
    },
    linkedOperationId: {
      type: Schema.Types.ObjectId,
      ref: 'Operation',
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Asset: Model<IAsset> = mongoose.models.Asset || mongoose.model<IAsset>('Asset', AssetSchema);

export default Asset;
