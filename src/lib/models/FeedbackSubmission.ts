import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type FeedbackSubmissionType = 'Bug' | 'Feature Request' | 'Enterprise' | 'Other';
export type FeedbackSubmissionSource = 'contact' | 'app';
export type FeedbackSubmissionStatus = 'new' | 'done';

export interface IFeedbackSubmission extends Document {
  type: FeedbackSubmissionType;
  subject: string;
  message: string;
  name: string;
  email: string;
  userId?: Types.ObjectId;
  organizationId?: string;
  source: FeedbackSubmissionSource;
  pageUrl?: string;
  status: FeedbackSubmissionStatus;
  createdAt: Date;
}

const FeedbackSubmissionSchema = new Schema<IFeedbackSubmission>(
  {
    type: {
      type: String,
      enum: ['Bug', 'Feature Request', 'Enterprise', 'Other'],
      required: true,
    },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    organizationId: { type: String, trim: true, index: true },
    source: {
      type: String,
      enum: ['contact', 'app'],
      required: true,
      index: true,
    },
    pageUrl: { type: String, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ['new', 'done'],
      default: 'new',
      index: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

FeedbackSubmissionSchema.index({ createdAt: -1 });
FeedbackSubmissionSchema.index({ status: 1, createdAt: -1 });

const FeedbackSubmission: Model<IFeedbackSubmission> =
  mongoose.models.FeedbackSubmission ||
  mongoose.model<IFeedbackSubmission>('FeedbackSubmission', FeedbackSubmissionSchema);

export default FeedbackSubmission;
