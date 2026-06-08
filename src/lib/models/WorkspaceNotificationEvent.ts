import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import {
  WORKSPACE_NOTIFICATION_EVENT_TYPES,
  type WorkspaceEntityKind,
  type WorkspaceNotificationEventType,
} from '@/lib/workspace/notificationTypes';

export interface IWorkspaceNotificationEvent extends Document {
  recipientUserId: Types.ObjectId;
  recipientEmployeeId: Types.ObjectId;
  organizationId: string;
  actorUserId?: Types.ObjectId;
  eventType: WorkspaceNotificationEventType;
  projectId: Types.ObjectId;
  projectName: string;
  entityKind: WorkspaceEntityKind;
  entityId?: string;
  entityLabel: string;
  taskIndex?: number;
  changeLabel: string;
  digestSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceNotificationEventSchema: Schema = new Schema(
  {
    recipientUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipientEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    organizationId: { type: String, required: true, index: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    eventType: {
      type: String,
      enum: WORKSPACE_NOTIFICATION_EVENT_TYPES,
      required: true,
    },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    projectName: { type: String, required: true, trim: true },
    entityKind: {
      type: String,
      enum: ['task', 'content', 'project'],
      required: true,
    },
    entityId: { type: String, trim: true },
    entityLabel: { type: String, required: true, trim: true },
    taskIndex: { type: Number },
    changeLabel: { type: String, required: true, trim: true },
    digestSentAt: { type: Date, index: true },
  },
  { timestamps: true }
);

WorkspaceNotificationEventSchema.index({ recipientUserId: 1, digestSentAt: 1, createdAt: -1 });

const WorkspaceNotificationEvent: Model<IWorkspaceNotificationEvent> =
  mongoose.models.WorkspaceNotificationEvent ||
  mongoose.model<IWorkspaceNotificationEvent>(
    'WorkspaceNotificationEvent',
    WorkspaceNotificationEventSchema
  );

export default WorkspaceNotificationEvent;
