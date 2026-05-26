import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import type { MeetingJoinPlatform } from '@/lib/scheduling/extractMeetingJoinUrl';

export interface IMeeting extends Document {
  userId: Types.ObjectId;
  organizationId: string;
  title: string;
  start: Date;
  end: Date;
  googleEventId?: string;
  /** Google recurring series id (instance.recurringEventId). */
  googleRecurringEventId?: string;
  iCalUID?: string;
  agendaToken: string;
  linkedProjectIds: Types.ObjectId[];
  /** Org employees invited to this meeting. */
  attendeeEmployeeIds?: Types.ObjectId[];
  /** External guest emails (normalized lowercase). */
  externalAttendeeEmails?: string[];
  createdInNucleas: boolean;
  description?: string;
  /** Video call URL extracted from Google Calendar on sync. */
  joinUrl?: string;
  joinPlatform?: MeetingJoinPlatform;
  createdAt: Date;
  updatedAt: Date;
}

const MeetingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    googleEventId: { type: String, trim: true, sparse: true },
    googleRecurringEventId: { type: String, trim: true, sparse: true },
    iCalUID: { type: String, trim: true, sparse: true },
    agendaToken: { type: String, required: true, index: true },
    linkedProjectIds: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
    attendeeEmployeeIds: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    externalAttendeeEmails: [{ type: String, trim: true, lowercase: true }],
    createdInNucleas: { type: Boolean, default: true },
    description: { type: String, trim: true },
    joinUrl: { type: String, trim: true },
    joinPlatform: {
      type: String,
      enum: ['google_meet', 'zoom', 'teams', 'discord', 'other'],
    },
  },
  { timestamps: true }
);

MeetingSchema.index({ userId: 1, start: 1 });
MeetingSchema.index({ userId: 1, googleRecurringEventId: 1 }, { sparse: true });
MeetingSchema.index({ organizationId: 1, iCalUID: 1 }, { sparse: true });
MeetingSchema.index({ organizationId: 1, googleRecurringEventId: 1 }, { sparse: true });

const Meeting: Model<IMeeting> =
  mongoose.models.Meeting || mongoose.model<IMeeting>('Meeting', MeetingSchema);

export default Meeting;
