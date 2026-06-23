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
  /** @deprecated Use linkedProjectTaskId for stable references. */
  linkedProjectTaskIndex?: number;
  /** Stable reference to project task (use project.tasks.id(linkedProjectTaskId) for lookup). */
  linkedProjectTaskId?: Types.ObjectId;
  linkedContentItemId?: Types.ObjectId;
  /** Direct link to a client (org-level assets). Mutually exclusive with project/task/content links. */
  linkedClientId?: Types.ObjectId;
  /** When true, asset is visible in the client portal for linked project or client. */
  clientAccessible?: boolean;
  /** Google Drive file id when asset is linked via Workspace integration. */
  googleFileId?: string;
  googleMimeType?: string;
  /** User whose Drive OAuth token created or attached this file. */
  googleConnectedByUserId?: Types.ObjectId;
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
    linkedProjectTaskId: {
      type: Schema.Types.ObjectId,
      ref: 'Project.tasks',
    },
    linkedContentItemId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentItem',
    },
    linkedClientId: {
      type: Schema.Types.ObjectId,
      ref: 'Client',
    },
    clientAccessible: {
      type: Boolean,
      default: false,
    },
    googleFileId: {
      type: String,
      trim: true,
    },
    googleMimeType: {
      type: String,
      trim: true,
    },
    googleConnectedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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
AssetSchema.index({ linkedClientId: 1 });
AssetSchema.index({ linkedProjectTaskId: 1 });
AssetSchema.index({ linkedContentItemId: 1 });
AssetSchema.index({ type: 1 });
AssetSchema.index({ tags: 1 });
AssetSchema.index({ createdAt: -1 });

const Asset: Model<IAsset> = mongoose.models.Asset || mongoose.model<IAsset>('Asset', AssetSchema);

export default Asset;
