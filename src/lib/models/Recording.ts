import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type RecordingStatus = 'uploading' | 'processing' | 'complete' | 'failed';

export interface IRecording extends Document {
  title: string;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  projectId?: Types.ObjectId;
  taskId?: Types.ObjectId;
  contentItemId?: Types.ObjectId;
  videoUrl: string;
  audioUrl?: string;
  duration: number;
  status: RecordingStatus;
  errorMessage?: string;
  transcript?: string;
  summary?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RecordingSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
    },
    taskId: {
      type: Schema.Types.ObjectId,
    },
    contentItemId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentItem',
    },
    videoUrl: {
      type: String,
      required: true,
      trim: true,
    },
    audioUrl: {
      type: String,
      trim: true,
    },
    duration: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['uploading', 'processing', 'complete', 'failed'],
      default: 'processing',
      required: true,
    },
    errorMessage: {
      type: String,
      trim: true,
    },
    transcript: {
      type: String,
      trim: true,
    },
    summary: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

RecordingSchema.index({ organizationId: 1, createdAt: -1 });
RecordingSchema.index({ projectId: 1, createdAt: -1 });
RecordingSchema.index({ title: 'text', transcript: 'text' });

const Recording: Model<IRecording> =
  mongoose.models.Recording || mongoose.model<IRecording>('Recording', RecordingSchema);

export default Recording;
