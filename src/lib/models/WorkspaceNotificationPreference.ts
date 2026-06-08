import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import {
  WORKSPACE_DIGEST_INTERVALS,
  type WorkspaceDigestInterval,
} from '@/lib/workspace/notificationTypes';

export interface IWorkspaceNotificationPreference extends Document {
  userId: Types.ObjectId;
  employeeId: Types.ObjectId;
  organizationId: string;
  interval: WorkspaceDigestInterval;
  lastDigestSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceNotificationPreferenceSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    organizationId: { type: String, required: true, index: true },
    interval: {
      type: String,
      enum: WORKSPACE_DIGEST_INTERVALS,
      default: 'off',
      required: true,
    },
    lastDigestSentAt: { type: Date },
  },
  { timestamps: true }
);

WorkspaceNotificationPreferenceSchema.index({ organizationId: 1, interval: 1 });

const WorkspaceNotificationPreference: Model<IWorkspaceNotificationPreference> =
  mongoose.models.WorkspaceNotificationPreference ||
  mongoose.model<IWorkspaceNotificationPreference>(
    'WorkspaceNotificationPreference',
    WorkspaceNotificationPreferenceSchema
  );

export default WorkspaceNotificationPreference;
