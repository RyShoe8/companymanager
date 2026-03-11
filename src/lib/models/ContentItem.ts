import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type ContentChannel = 'X' | 'LinkedIn' | 'Instagram' | 'TikTok' | 'Email' | 'Article' | 'Video' | 'Reddit' | 'Bluesky' | 'Other';
export type ContentStatus = 'idea' | 'planned' | 'in_progress' | 'ready' | 'published';

export interface IContentItem extends Document {
  projectId: Types.ObjectId;
  title: string;
  channel: ContentChannel;
  status: ContentStatus;
  publishDate?: Date;
  notes?: string;
  assignedToEmployeeId?: Types.ObjectId;
  userId: Types.ObjectId;
  keywords?: string[];
  internalLinks?: string[];
  externalUrl?: string;
  estimatedHours?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ContentItemSchema: Schema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true, trim: true },
    channel: {
      type: String,
      required: true,
      enum: ['X', 'LinkedIn', 'Instagram', 'TikTok', 'Email', 'Article', 'Video', 'Reddit', 'Bluesky', 'Other'],
    },
    status: {
      type: String,
      required: true,
      enum: ['idea', 'planned', 'in_progress', 'ready', 'published'],
      default: 'planned',
    },
    publishDate: { type: Date },
    notes: { type: String, trim: true },
    assignedToEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    keywords: { type: [String], default: [] },
    internalLinks: { type: [String], default: [] },
    externalUrl: { type: String, trim: true },
    estimatedHours: { type: Number, min: 0 },
  },
  { timestamps: true }
);

ContentItemSchema.index({ projectId: 1, publishDate: 1 });

const ContentItem: Model<IContentItem> =
  mongoose.models.ContentItem ||
  mongoose.model<IContentItem>('ContentItem', ContentItemSchema);

export default ContentItem;
