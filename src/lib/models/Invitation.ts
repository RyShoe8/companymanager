import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type InvitationStatus = 'pending' | 'accepted' | 'expired';

export interface IInvitation extends Document {
  email: string;
  token: string; // Unique token for the invitation link
  organizationId: string; // Organization identifier (userId of admin)
  employeeId?: Types.ObjectId; // Reference to the Employee record if created
  role: 'Administrator' | 'Manager' | 'User'; // Role for the employee
  jobTitle?: string;
  weeklyHours?: number;
  employeeType?: 'full-time' | 'part-time' | 'contractor';
  expiresAt: Date;
  status: InvitationStatus;
  invitedBy: Types.ObjectId; // User who sent the invitation
  createdAt: Date;
  updatedAt: Date;
}

const InvitationSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    organizationId: {
      type: String,
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
    },
    role: {
      type: String,
      enum: ['Administrator', 'Manager', 'User'],
      required: true,
      default: 'User',
    },
    jobTitle: {
      type: String,
      trim: true,
    },
    weeklyHours: {
      type: Number,
      min: 0,
      max: 168,
    },
    employeeType: {
      type: String,
      enum: ['full-time', 'part-time', 'contractor'],
      default: 'full-time',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired'],
      default: 'pending',
      index: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient lookups
InvitationSchema.index({ token: 1, status: 1 });
InvitationSchema.index({ email: 1, organizationId: 1, status: 1 });

const Invitation: Model<IInvitation> =
  mongoose.models.Invitation || mongoose.model<IInvitation>('Invitation', InvitationSchema);

export default Invitation;
