import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IMeetingSeriesSettings extends Document {
  organizationId: string;
  googleRecurringEventId?: string;
  iCalUID?: string;
  linkedProjectIds: Types.ObjectId[];
  linkedClientIds?: Types.ObjectId[];
  agendaToken: string;
  attendeeEmployeeIds: Types.ObjectId[];
  externalAttendeeEmails: string[];
  recurrencePreset?: string;
  recurrenceCount?: number;
  updatedAt: Date;
  createdAt: Date;
}

const MeetingSeriesSettingsSchema = new Schema(
  {
    organizationId: { type: String, required: true, index: true },
    googleRecurringEventId: { type: String, trim: true, sparse: true },
    iCalUID: { type: String, trim: true, sparse: true },
    linkedProjectIds: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
    linkedClientIds: [{ type: Schema.Types.ObjectId, ref: 'Client' }],
    agendaToken: { type: String, required: true },
    attendeeEmployeeIds: [{ type: Schema.Types.ObjectId, ref: 'Employee' }],
    externalAttendeeEmails: [{ type: String, trim: true, lowercase: true }],
    recurrencePreset: { type: String, trim: true },
    recurrenceCount: { type: Number, min: 1 },
  },
  { timestamps: true }
);

MeetingSeriesSettingsSchema.index(
  { organizationId: 1, googleRecurringEventId: 1 },
  { unique: true, sparse: true }
);
MeetingSeriesSettingsSchema.index(
  { organizationId: 1, iCalUID: 1 },
  { unique: true, sparse: true }
);
MeetingSeriesSettingsSchema.index({ agendaToken: 1 });

const MeetingSeriesSettings: Model<IMeetingSeriesSettings> =
  mongoose.models.MeetingSeriesSettings ||
  mongoose.model<IMeetingSeriesSettings>('MeetingSeriesSettings', MeetingSeriesSettingsSchema);

export default MeetingSeriesSettings;
