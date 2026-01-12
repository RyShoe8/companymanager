import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type RecurrenceType = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type OperationStatus = 'planned' | 'active' | 'complete';

export interface IOperation extends Document {
  name: string;
  description?: string;
  recurrenceType: RecurrenceType;
  status: OperationStatus;
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
    recurrenceType: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
      required: true,
    },
    status: {
      type: String,
      enum: ['planned', 'active', 'complete'],
      default: 'planned',
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
