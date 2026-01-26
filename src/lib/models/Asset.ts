import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type AssetType = 'spreadsheet' | 'document' | 'tool' | 'folder' | 'link' | 'screenshot' | 'file' | 'text' | 'other';

export interface IAsset extends Document {
  name: string;
  type: AssetType;
  url?: string;
  fileUrl?: string; // For uploaded files
  textContent?: string; // For text assets
  description?: string;
  category?: string;
  tags: string[];
  linkedProjectId?: Types.ObjectId;
  linkedProjectTaskIndex?: number; // Index of the task in the project's tasks array
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
      enum: ['spreadsheet', 'document', 'tool', 'folder', 'link', 'screenshot', 'file', 'text', 'other'],
      required: true,
    },
    url: {
      type: String,
      trim: true,
    },
    fileUrl: {
      type: String,
      trim: true,
    },
    textContent: {
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
    linkedProjectTaskIndex: {
      type: Number,
      min: 0,
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

// Add indexes for better query performance
AssetSchema.index({ userId: 1 });
AssetSchema.index({ linkedProjectId: 1 });
AssetSchema.index({ linkedOperationId: 1 });
AssetSchema.index({ type: 1 });
AssetSchema.index({ tags: 1 });
AssetSchema.index({ createdAt: -1 });

const Asset: Model<IAsset> = mongoose.models.Asset || mongoose.model<IAsset>('Asset', AssetSchema);

export default Asset;
