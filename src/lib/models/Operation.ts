import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type RecurrenceType = 'none' | 'weekly' | 'bi-weekly' | 'monthly';
export type OperationStatus = 'active' | 'completed' | 'in-review';

export interface IOperation extends Document {
  name: string;
  description?: string;
  url?: string;
  recurrenceType: RecurrenceType;
  status: OperationStatus;
  assignedTo?: string; // Legacy - kept for backward compatibility
  assignedToEmployeeId?: Types.ObjectId; // New field using employee ID
  estimatedHours?: number;
  startDate?: Date;
  endDate?: Date;
  projectId?: Types.ObjectId; // Link to project if created from a launched project
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
      enum: ['active', 'completed', 'in-review'],
      default: 'active',
    },
    assignedTo: {
      type: String,
      trim: true,
    },
    assignedToEmployeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
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
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
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
OperationSchema.index({ userId: 1 });
OperationSchema.index({ status: 1 });
OperationSchema.index({ recurrenceType: 1 });
OperationSchema.index({ assignedToEmployeeId: 1 });
OperationSchema.index({ projectId: 1 });
OperationSchema.index({ createdAt: -1 });

const Operation: Model<IOperation> =
  mongoose.models.Operation || mongoose.model<IOperation>('Operation', OperationSchema);

export default Operation;
