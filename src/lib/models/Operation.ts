import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type RecurrenceType = 'none' | 'weekly' | 'bi-weekly' | 'monthly';
export type OperationStatus = 'planning' | 'active' | 'in-review' | 'complete';

export interface IOperation extends Document {
  name: string;
  description?: string;
  url?: string;
  recurrenceType: RecurrenceType;
  status: OperationStatus;
  assignedTo?: string;
  estimatedHours?: number;
  startDate?: Date;
  endDate?: Date;
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OperationSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    url: {
      type: String,
      trim: true,
    },
    recurrenceType: {
      type: String,
      enum: ['none', 'weekly', 'bi-weekly', 'monthly'],
      required: true,
      default: 'none',
    },
    status: {
      type: String,
      enum: ['planning', 'active', 'in-review', 'complete'],
      default: 'planning',
    },
    assignedTo: {
      type: String,
      trim: true,
    },
    estimatedHours: {
      type: Number,
      min: 0,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
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

const Operation: Model<IOperation> =
  mongoose.models.Operation || mongoose.model<IOperation>('Operation', OperationSchema);

export default Operation;
